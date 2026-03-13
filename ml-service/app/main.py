from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Set

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="BackToYou ML Service", version="1.0.0")

class ItemPublic(BaseModel):
    id: str
    type: Literal["LOST", "FOUND"]
    title: str
    description: Optional[str] = ""
    category: str
    color: Optional[str] = ""
    location: Optional[str] = ""
    eventAt: str = Field(..., description="ISO timestamp")


class ScoreRequest(BaseModel):
    target: ItemPublic
    candidates: List[ItemPublic]


class ScoreBreakdown(BaseModel):
    token_note: str
    scores: Dict[str, float]
    date_days_apart: Optional[float] = None


class ScoreResult(BaseModel):
    candidateId: str
    textSimilarity: float
    ruleScore: float
    finalScore: float
    confidenceLevel: Literal["HIGH_CONFIDENCE", "AMBIGUOUS"]
    breakdown: ScoreBreakdown


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def _parse_dt(iso: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _tok(s: Optional[str]) -> Set[str]:
    return {t for t in _norm(s).replace("-", " ").split() if len(t) >= 2}


def _rule_score(lost: ItemPublic, found: ItemPublic) -> tuple[float, Dict[str, float], Optional[float]]:
    category_score = 1.0 if _norm(lost.category) and _norm(lost.category) == _norm(found.category) else 0.0

    ca, cb = _norm(lost.color), _norm(found.color)
    color_score = 1.0 if ca and cb and (ca == cb or ca in cb or cb in ca) else 0.0

    la, lb = _tok(lost.location), _tok(found.location)
    location_score = 0.0
    if la and lb:
        inter = len(la.intersection(lb))
        union = len(la.union(lb))
        location_score = float(inter) / float(union) if union else 0.0

    days_apart: Optional[float] = None
    date_score = 0.0
    a = _parse_dt(lost.eventAt)
    b = _parse_dt(found.eventAt)
    if a and b:
        days_apart = abs((a - b).total_seconds()) / 86400.0
        date_score = max(0.0, min(1.0, 1.0 - float(days_apart) / 14.0))

    # Prompt requirement: rule_score is an unweighted average of component scores.
    rs = (category_score + color_score + location_score + date_score) / 4.0
    scores: Dict[str, float] = {
        "categoryScore": category_score,
        "colorScore": color_score,
        "locationScore": location_score,
        "dateScore": date_score,
    }
    return float(max(0.0, min(1.0, rs))), scores, days_apart


def _text_blob(item: ItemPublic) -> str:
    parts = [item.title, item.description or "", item.category, item.color or "", item.location or ""]
    return " ".join([p for p in parts if p]).strip().lower()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True}


@app.post("/score", response_model=List[ScoreResult])
def score(req: ScoreRequest, x_ml_token: Optional[str] = Header(default=None)) -> List[ScoreResult]:
    # Optional shared-secret auth (recommended for production).
    # If ML_SERVICE_TOKEN is set, backend must send header: x-ml-token: <token>
    expected = os.getenv("ML_SERVICE_TOKEN")
    if expected and (x_ml_token or "") != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Build corpus from candidates (public-only) and score target vs each candidate.
    docs = [_text_blob(req.target)] + [_text_blob(c) for c in req.candidates]

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_features=5000,
    )
    X = vectorizer.fit_transform(docs)
    target_vec = X[0:1]
    cand_vecs = X[1:]
    sims = cosine_similarity(target_vec, cand_vecs).flatten() if len(req.candidates) else []

    results: List[ScoreResult] = []
    for idx, cand in enumerate(req.candidates):
        text_sim = float(sims[idx]) if len(req.candidates) else 0.0

        lost, found = (req.target, cand) if req.target.type == "LOST" else (cand, req.target)
        rs, rule_scores, days_apart = _rule_score(lost, found)
        final = 0.6 * text_sim + 0.4 * rs

        conf = "HIGH_CONFIDENCE" if final >= 0.90 else "AMBIGUOUS"
        results.append(
            ScoreResult(
                candidateId=cand.id,
                textSimilarity=text_sim,
                ruleScore=rs,
                finalScore=float(final),
                confidenceLevel=conf,  # never implies auto-return
                breakdown=ScoreBreakdown(
                    token_note="TF-IDF over live item corpus; stopwords removed via scikit-learn",
                    scores={
                        "textSimilarity": float(text_sim),
                        **rule_scores,
                        "ruleScore": float(rs),
                        "finalScore": float(final),
                    },
                    date_days_apart=days_apart,
                ),
            )
        )

    results.sort(key=lambda r: r.finalScore, reverse=True)
    return results[:10]
