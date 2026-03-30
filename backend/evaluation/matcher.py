from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from generate_data import build_text_series


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def canonical_color(color: str) -> str:
    color = _norm(color)
    synonyms = {
        "navy": "blue",
        "violet": "purple",
        "maroon": "red",
        "silver": "gray",
    }
    return synonyms.get(color, color)


def location_key(location: str) -> str:
    # For synthetic data locations are simple labels; keep as normalized string.
    return _norm(location)


@dataclass(frozen=True)
class RuleWeights:
    category: float = 0.35
    color: float = 0.25
    location: float = 0.25
    date: float = 0.15


@dataclass(frozen=True)
class ScoreWeights:
    text: float = 0.6
    rules: float = 0.4


class TfidfRuleMatcher:
    """
    Standalone evaluator matcher:
      finalScore = 0.6 * textSimilarity + 0.4 * ruleScore
    """

    def __init__(
        self,
        score_weights: ScoreWeights = ScoreWeights(),
        rule_weights: RuleWeights = RuleWeights(),
        max_features: int = 20000,
        ngram_range: Tuple[int, int] = (1, 2),
    ) -> None:
        self.score_weights = score_weights
        self.rule_weights = rule_weights
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            lowercase=True,
            max_features=max_features,
            ngram_range=ngram_range,
        )
        self._candidate_df: Optional[pd.DataFrame] = None
        self._candidate_matrix = None

    def fit(self, candidates_df: pd.DataFrame) -> "TfidfRuleMatcher":
        self._candidate_df = candidates_df.reset_index(drop=True).copy()
        candidate_text = build_text_series(self._candidate_df).tolist()
        self._candidate_matrix = self.vectorizer.fit_transform(candidate_text)

        # Precompute normalized fields for faster scoring.
        self._candidate_df["_category_norm"] = self._candidate_df["category"].fillna("").map(_norm)
        self._candidate_df["_color_norm"] = self._candidate_df["color"].fillna("").map(canonical_color)
        self._candidate_df["_location_norm"] = self._candidate_df["location"].fillna("").map(location_key)
        self._candidate_df["_date_dt"] = pd.to_datetime(self._candidate_df["date"], errors="coerce")
        return self

    def _check_ready(self) -> None:
        if self._candidate_df is None or self._candidate_matrix is None:
            raise RuntimeError("Matcher not fit. Call fit(candidates_df) first.")

    def text_similarity(self, query_text: str) -> np.ndarray:
        self._check_ready()
        q_vec = self.vectorizer.transform([query_text or ""])
        sims = cosine_similarity(q_vec, self._candidate_matrix).ravel()
        return sims.astype(float)

    def rule_score(self, query_row: dict) -> np.ndarray:
        self._check_ready()
        cdf = self._candidate_df
        assert cdf is not None

        q_cat = _norm(str(query_row.get("category", "")))
        q_col = canonical_color(str(query_row.get("color", "")))
        q_loc = location_key(str(query_row.get("location", "")))
        q_date = pd.to_datetime(query_row.get("date", None), errors="coerce")

        cat = (cdf["_category_norm"].values == q_cat).astype(float)
        col = (cdf["_color_norm"].values == q_col).astype(float)
        loc = (cdf["_location_norm"].values == q_loc).astype(float)

        # Date score: decay with distance in days (0..1).
        # If date is missing on either side, give a neutral 0.5.
        cand_dates = cdf["_date_dt"].values
        if pd.isna(q_date):
            date_score = np.full(shape=(len(cdf),), fill_value=0.5, dtype=float)
        else:
            # Convert q_date to numpy datetime64[ns] for vector ops
            qd = np.datetime64(pd.to_datetime(q_date))
            valid = ~pd.isna(cand_dates)
            date_score = np.full(shape=(len(cdf),), fill_value=0.5, dtype=float)
            if np.any(valid):
                deltas = np.abs((cand_dates[valid].astype("datetime64[D]") - qd.astype("datetime64[D]")).astype(int))
                # 0 days => 1.0, 30+ days => near 0.0
                date_score[valid] = np.clip(1.0 - (deltas / 30.0), 0.0, 1.0)

        rw = self.rule_weights
        denom = float(rw.category + rw.color + rw.location + rw.date)
        rules = (rw.category * cat + rw.color * col + rw.location * loc + rw.date * date_score) / denom
        return rules.astype(float)

    def final_scores(self, query_row: dict) -> np.ndarray:
        query_text = f"{query_row.get('title','')} {query_row.get('description','')}".strip()
        text_sims = self.text_similarity(query_text)
        rules = self.rule_score(query_row)
        sw = self.score_weights
        final = sw.text * text_sims + sw.rules * rules
        return final.astype(float)

    def rank_candidates(
        self, query_row: dict, top_k: int = 10
    ) -> List[Tuple[str, float, float, float]]:
        """
        Returns list of (item_id, finalScore, textSimilarity, ruleScore) sorted desc by finalScore.
        """
        self._check_ready()
        cdf = self._candidate_df
        assert cdf is not None

        query_text = f"{query_row.get('title','')} {query_row.get('description','')}".strip()
        text_sims = self.text_similarity(query_text)
        rules = self.rule_score(query_row)
        sw = self.score_weights
        final = sw.text * text_sims + sw.rules * rules

        order = np.argsort(-final)[: max(1, int(top_k))]
        results: List[Tuple[str, float, float, float]] = []
        for idx in order:
            results.append(
                (
                    str(cdf.loc[idx, "item_id"]),
                    float(final[idx]),
                    float(text_sims[idx]),
                    float(rules[idx]),
                )
            )
        return results

