from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

import numpy as np


def top_k_accuracy(ranks: List[int], k: int) -> float:
    if not ranks:
        return 0.0
    return float(np.mean([r <= k for r in ranks]))


def mean_reciprocal_rank(ranks: List[int]) -> float:
    if not ranks:
        return 0.0
    return float(np.mean([1.0 / r for r in ranks if r > 0]))


@dataclass(frozen=True)
class PRF:
    precision: float
    recall: float
    f1: float


def precision_recall_f1_at_k(ranks: List[int], k: int) -> PRF:
    """
    For each query there is exactly 1 relevant item.
    Retrieve top-k items.

    - Precision@k = (#queries where relevant is in top-k) / (k * #queries)
    - Recall@k = (#queries where relevant is in top-k) / (#queries)
    - F1@k computed from those.
    """
    if not ranks:
        return PRF(precision=0.0, recall=0.0, f1=0.0)

    hits = sum(1 for r in ranks if r <= k)
    q = len(ranks)
    precision = hits / float(k * q)
    recall = hits / float(q)
    f1 = 0.0 if (precision + recall) == 0.0 else (2.0 * precision * recall / (precision + recall))
    return PRF(precision=float(precision), recall=float(recall), f1=float(f1))


def build_metrics_report(ranks: List[int]) -> Dict[str, float]:
    top1 = top_k_accuracy(ranks, 1)
    top3 = top_k_accuracy(ranks, 3)
    prf = precision_recall_f1_at_k(ranks, 3)
    mrr = mean_reciprocal_rank(ranks)
    return {
        "top1_accuracy": float(top1),
        "top3_accuracy": float(top3),
        # Precision/Recall/F1 are computed at k=3 for this retrieval task.
        "precision": float(prf.precision),
        "recall": float(prf.recall),
        "f1": float(prf.f1),
        "mrr": float(mrr),
    }
