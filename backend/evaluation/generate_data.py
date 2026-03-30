from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SyntheticConfig:
    num_pairs: int = 120
    seed: int = 42
    start_date: date = date(2026, 1, 1)
    day_span: int = 75


_CATEGORIES = [
    "electronics",
    "keys",
    "bags",
    "documents",
    "clothing",
    "accessories",
    "jewelry",
    "sports",
]

_COLORS = [
    "black",
    "white",
    "gray",
    "blue",
    "navy",
    "red",
    "green",
    "yellow",
    "orange",
    "purple",
    "brown",
    "pink",
]

_LOCATIONS = [
    "Downtown",
    "Central Park",
    "Main Library",
    "City Mall",
    "North Campus",
    "South Campus",
    "Bus Station",
    "Train Station",
    "Airport Terminal",
    "Community Center",
    "Riverside Walk",
    "Tech Park",
]

_BRANDS = [
    "Apple",
    "Samsung",
    "Sony",
    "Dell",
    "Lenovo",
    "Nike",
    "Adidas",
    "Fossil",
    "Ray-Ban",
    "Casio",
    "Puma",
    "HP",
]

_ITEMS_BY_CATEGORY = {
    "electronics": ["phone", "laptop", "tablet", "earbuds", "smartwatch", "camera", "power bank"],
    "keys": ["car keys", "house keys", "keychain", "bike key"],
    "bags": ["backpack", "handbag", "laptop bag", "duffel bag", "tote bag", "wallet"],
    "documents": ["passport", "ID card", "driver license", "student ID", "document folder"],
    "clothing": ["jacket", "hoodie", "cap", "scarf", "sweater", "gloves"],
    "accessories": ["sunglasses", "watch strap", "belt", "earrings case", "charging cable"],
    "jewelry": ["ring", "bracelet", "necklace", "earrings"],
    "sports": ["water bottle", "gym bag", "football", "tennis racket", "helmet"],
}

_TEXT_NOISE = [
    "slightly scratched",
    "in good condition",
    "brand new",
    "with a small dent",
    "with initials on it",
    "has a sticker",
    "with a protective cover",
    "no visible damage",
]


def _pick(rng: random.Random, values: List[str]) -> str:
    return values[rng.randrange(0, len(values))]


def _make_date(rng: random.Random, cfg: SyntheticConfig) -> date:
    return cfg.start_date + timedelta(days=rng.randrange(0, cfg.day_span))


def _normalize_color(color: str) -> str:
    # Keep this in sync with matcher.py color canonicalization.
    color = (color or "").strip().lower()
    synonyms = {"navy": "blue"}
    return synonyms.get(color, color)


def _make_title(rng: random.Random, category: str, color: str, brand: str, item: str) -> str:
    color = _normalize_color(color)
    if category == "electronics":
        model = rng.choice(["Pro", "Air", "Plus", "S", "Ultra"])
        gen = rng.choice(["11", "12", "13", "14", "15"])
        return f"{color.title()} {brand} {item.title()} {gen} {model}".strip()
    if category == "documents":
        return f"{color.title()} {item.title()}"
    return f"{color.title()} {item.title()}"


def _make_description(
    rng: random.Random,
    category: str,
    brand: str,
    item: str,
    location: str,
    found_or_lost: str,
) -> str:
    noise = _pick(rng, _TEXT_NOISE)
    if category == "electronics":
        extras = rng.choice(
            [
                "charger not included",
                "in a slim case",
                "screen protector applied",
                "with earbuds case",
                "battery around 80%",
            ]
        )
        return f"{found_or_lost.title()} a {brand} {item} near {location}. {noise}. {extras}."
    if category == "documents":
        return f"{found_or_lost.title()} a {item} near {location}. {noise}. Contains important papers."
    if category == "keys":
        return f"{found_or_lost.title()} {item} near {location}. {noise}. Has 2-3 keys attached."
    return f"{found_or_lost.title()} a {item} near {location}. {noise}."


def generate_synthetic_dataset(
    num_pairs: int = 120,
    seed: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, str]]:
    """
    Returns:
      found_items_df: candidates to retrieve (one correct per query)
      queries_df: synthetic "lost" queries
      ground_truth: mapping query_id -> found_id
    """
    cfg = SyntheticConfig(num_pairs=num_pairs, seed=seed)
    rng = random.Random(seed)

    found_rows: List[dict] = []
    query_rows: List[dict] = []
    ground_truth: Dict[str, str] = {}

    for i in range(cfg.num_pairs):
        category = _pick(rng, _CATEGORIES)
        raw_color = _pick(rng, _COLORS)
        color = _normalize_color(raw_color)
        location = _pick(rng, _LOCATIONS)
        found_date = _make_date(rng, cfg)

        brand = _pick(rng, _BRANDS)
        item = _pick(rng, _ITEMS_BY_CATEGORY[category])

        found_id = f"found_{i:04d}"
        query_id = f"q_{i:04d}"

        found_title = _make_title(rng, category, color, brand, item)
        found_desc = _make_description(rng, category, brand, item, location, "found")

        # Query: keep same identity but inject small noise (missing brand, color synonym, date offset).
        query_date = found_date + timedelta(days=int(rng.choice([-3, -2, -1, 0, 1, 2, 3, 7, -7])))
        query_color = rng.choice([color, raw_color, color, color, rng.choice(["black", "blue", "red"])])
        query_color = _normalize_color(query_color)
        query_location = rng.choice([location, location, location, _pick(rng, _LOCATIONS)])

        lost_brand = rng.choice([brand, "", brand, brand])
        title_bits = [query_color.title(), lost_brand, item.title()]
        query_title = " ".join([b for b in title_bits if b]).strip()
        query_desc = _make_description(rng, category, brand if lost_brand else "Unknown", item, query_location, "lost")

        found_rows.append(
            {
                "item_id": found_id,
                "type": "found",
                "title": found_title,
                "description": found_desc,
                "category": category,
                "color": color,
                "location": location,
                "date": pd.to_datetime(found_date),
            }
        )

        query_rows.append(
            {
                "query_id": query_id,
                "type": "lost",
                "title": query_title,
                "description": query_desc,
                "category": category,
                "color": query_color,
                "location": query_location,
                "date": pd.to_datetime(query_date),
                "ground_truth_item_id": found_id,
            }
        )

        ground_truth[query_id] = found_id

    found_df = pd.DataFrame(found_rows)
    queries_df = pd.DataFrame(query_rows)

    # Shuffle to avoid any accidental ordering advantage.
    found_df = found_df.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    queries_df = queries_df.sample(frac=1.0, random_state=seed).reset_index(drop=True)

    # Ensure we generated at least 100 samples as required.
    if len(found_df) < 100 or len(queries_df) < 100:
        raise ValueError("Synthetic dataset too small; increase num_pairs to at least 100.")

    return found_df, queries_df, ground_truth


def build_text_series(df: pd.DataFrame) -> pd.Series:
    """
    Returns a single text field used for TF-IDF: title + description.
    """
    title = df["title"].fillna("").astype(str)
    desc = df["description"].fillna("").astype(str)
    return (title + " " + desc).str.strip()


def summarize_dataset(found_df: pd.DataFrame, queries_df: pd.DataFrame) -> Dict[str, object]:
    return {
        "found_count": int(len(found_df)),
        "query_count": int(len(queries_df)),
        "categories": sorted(found_df["category"].dropna().unique().tolist()),
        "locations": int(found_df["location"].dropna().nunique()),
        "colors": sorted(found_df["color"].dropna().unique().tolist()),
    }

