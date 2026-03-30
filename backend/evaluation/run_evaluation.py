from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple


def _format_pct(x: float) -> str:
    return f"{x * 100.0:.2f}%"


def _format_float(x: float) -> str:
    return f"{x:.4f}"


def evaluate(num_pairs: int, seed: int, top_k: int) -> Tuple[Dict[str, object], Dict[str, float], List[dict]]:
    import numpy as np
    import pandas as pd

    from generate_data import generate_synthetic_dataset, summarize_dataset
    from matcher import TfidfRuleMatcher
    from metrics import build_metrics_report

    found_df, queries_df, _ = generate_synthetic_dataset(num_pairs=num_pairs, seed=seed)
    ds_summary = summarize_dataset(found_df, queries_df)

    matcher = TfidfRuleMatcher().fit(found_df)

    # Map item_id -> row index for rank lookup
    item_ids = found_df["item_id"].astype(str).tolist()
    idx_by_id = {item_id: idx for idx, item_id in enumerate(item_ids)}

    ranks: List[int] = []
    examples: List[dict] = []

    for _, q in queries_df.iterrows():
        qrow = q.to_dict()
        gt_id = str(qrow["ground_truth_item_id"])
        scores = matcher.final_scores(qrow)

        gt_idx = idx_by_id.get(gt_id, None)
        if gt_idx is None:
            # Should never happen, but keep evaluation resilient.
            ranks.append(0)
            continue

        # 1-based rank of the ground-truth item among all candidates.
        gt_score = float(scores[gt_idx])
        rank = int(1 + np.sum(scores > gt_score))
        ranks.append(rank)

        # Capture a few failures for reporting.
        if rank != 1 and len(examples) < 10:
            top = matcher.rank_candidates(qrow, top_k=top_k)
            examples.append(
                {
                    "query_id": qrow["query_id"],
                    "ground_truth_item_id": gt_id,
                    "ground_truth_rank": rank,
                    "top_candidates": top,
                }
            )

    metrics = build_metrics_report(ranks)
    meta = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "num_pairs": int(num_pairs),
        "seed": int(seed),
        "top_k": int(top_k),
        **ds_summary,
    }
    return meta, metrics, examples


def write_report(path: Path, meta: Dict[str, object], metrics: Dict[str, float], examples: List[dict]) -> None:
    lines: List[str] = []
    lines.append("BackToYou Matching Engine - Synthetic Evaluation Report")
    lines.append("=" * 58)
    lines.append(f"Generated at: {meta['generated_at']}")
    lines.append("")

    lines.append("Dataset")
    lines.append("-" * 7)
    lines.append(f"Found items (candidates): {meta['found_count']}")
    lines.append(f"Lost queries: {meta['query_count']}")
    lines.append(f"Categories: {', '.join(meta['categories'])}")
    lines.append(f"Unique locations: {meta['locations']}")
    lines.append("")

    lines.append("Scoring")
    lines.append("-" * 7)
    lines.append("finalScore = 0.6 * textSimilarity + 0.4 * ruleScore")
    lines.append("textSimilarity: TF-IDF (1-2 grams) + cosine similarity")
    lines.append("ruleScore components: category, color, location, date (normalized to 0..1)")
    lines.append("")

    lines.append("Metrics")
    lines.append("-" * 7)
    lines.append(f"Top-1 Accuracy: {_format_pct(metrics['top1_accuracy'])}")
    lines.append(f"Top-3 Accuracy: {_format_pct(metrics['top3_accuracy'])}")
    lines.append(f"Precision: {_format_float(metrics['precision'])}")
    lines.append(f"Recall: {_format_float(metrics['recall'])}")
    lines.append(f"F1 Score: {_format_float(metrics['f1'])}")
    lines.append(f"MRR: {_format_float(metrics['mrr'])}")
    lines.append("")
    lines.append("Notes")
    lines.append("-" * 5)
    lines.append("Precision/Recall/F1 are computed at k=3 with exactly 1 relevant item per query.")
    lines.append("Recall equals Top-3 Accuracy in this single-relevant-item setup.")
    lines.append("")

    if examples:
        lines.append("Sample Non-Top1 Queries (up to 10)")
        lines.append("-" * 32)
        for ex in examples:
            lines.append(
                f"- {ex['query_id']}: gt={ex['ground_truth_item_id']} rank={ex['ground_truth_rank']}"
            )
            for (item_id, final_s, text_s, rule_s) in ex["top_candidates"][:5]:
                lines.append(
                    f"    {item_id}  final={final_s:.4f}  text={text_s:.4f}  rules={rule_s:.4f}"
                )
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    try:
        import numpy  # noqa: F401
        import pandas  # noqa: F401
        import sklearn  # noqa: F401
    except ModuleNotFoundError as e:
        missing = getattr(e, "name", None) or "a required dependency"
        req_path = Path(__file__).parent / "requirements.txt"
        print("")
        print(f"Missing Python dependency: {missing}")
        print("Install evaluation dependencies and re-run.")
        if req_path.exists():
            print(f"Suggested: python -m pip install -r {req_path}")
        else:
            print("Suggested: python -m pip install numpy pandas scikit-learn")
        print("")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Run synthetic evaluation for matching engine (standalone).")
    parser.add_argument("--num-pairs", type=int, default=120, help="Number of found<->lost pairs to generate.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument("--top-k", type=int, default=10, help="Top-k candidates to show in failure examples.")
    args = parser.parse_args()

    meta, metrics, examples = evaluate(num_pairs=args.num_pairs, seed=args.seed, top_k=args.top_k)

    report_path = Path(__file__).parent / "evaluation_report.txt"
    write_report(report_path, meta, metrics, examples)

    print("")
    print("Synthetic Evaluation Summary")
    print("=" * 28)
    print(f"Candidates: {meta['found_count']} | Queries: {meta['query_count']} | Seed: {meta['seed']}")
    print(f"Top-1 Accuracy: {_format_pct(metrics['top1_accuracy'])}")
    print(f"Top-3 Accuracy: {_format_pct(metrics['top3_accuracy'])}")
    print(f"Precision: {_format_float(metrics['precision'])}")
    print(f"Recall: {_format_float(metrics['recall'])}")
    print(f"F1 Score: {_format_float(metrics['f1'])}")
    print(f"MRR: {_format_float(metrics['mrr'])}")
    print(f"Saved report: {report_path}")
    print("")


if __name__ == "__main__":
    main()
