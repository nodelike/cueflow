#!/usr/bin/env python3
"""Cross-check every Cueflow recording with Mixgraph's public search index."""

from __future__ import annotations

import csv
import json
import re
import time
import unicodedata
from pathlib import Path

import requests


INPUT = Path("research/preview-analysis.csv")
OUTPUT = Path("research/mixgraph-crosscheck.csv")


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    value = re.sub(r"\(feat\.[^)]+\)", "", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def same_recording(row: dict[str, str], item: dict[str, object]) -> bool:
    if item.get("spotify_id") == row["spotify_id"]:
        return True
    title_match = normalized(str(item.get("title", ""))) == normalized(row["title"])
    source_artist = normalized(str(item.get("artist", "")))
    artist_match = normalized(row["artist"].split(",")[0]) in source_artist or source_artist in normalized(row["artist"])
    duration_ms = int(item.get("duration_ms") or 0)
    duration_match = abs(duration_ms / 1000 - int(row["duration_seconds"])) <= 5
    return title_match and artist_match and duration_match


def main() -> None:
    rows = list(csv.DictReader(INPUT.open(encoding="utf-8")))
    session = requests.Session()
    session.headers["User-Agent"] = "Cueflow personal research/1.0"
    output: list[dict[str, str]] = []
    for index, row in enumerate(rows, 1):
        queries = [f"{row['title']} {row['artist']}", f"{row['title']} {row['artist'].split(',')[0]}"]
        item: dict[str, object] = {}
        identity = ""
        for query in queries:
            response = session.get("https://www.mixgraph.io/api/search", params={"q": query}, timeout=25)
            response.raise_for_status()
            items = response.json().get("tracks", {}).get("items", [])
            match = next((candidate for candidate in items if candidate.get("spotify_id") == row["spotify_id"]), None)
            if match:
                item, identity = match, "exact-id"
                break
            match = next((candidate for candidate in items if same_recording(row, candidate)), None)
            if match:
                item, identity = match, "same-recording"
                break
        output.append({
            "track_id": row["track_id"],
            "spotify_id": row["spotify_id"],
            "title": row["title"],
            "artist": row["artist"],
            "matched": str(bool(item)).lower(),
            "identity_match": identity,
            "source_spotify_id": item.get("spotify_id", ""),
            "source_url": f"https://www.mixgraph.io/tracks/{item.get('slug', '')}" if item else "",
            "bpm": item.get("bpm", ""),
            "camelot": item.get("camelot_key", ""),
            "key_number": item.get("key", ""),
            "mode": item.get("mode", ""),
            "energy": item.get("energy", ""),
            "danceability": item.get("danceability", ""),
            "valence": item.get("valence", ""),
            "instrumentalness": item.get("instrumentalness", ""),
            "drive": item.get("drive", ""),
            "groove": item.get("groove", ""),
            "brightness": item.get("brightness", ""),
            "warmth": item.get("warmth", ""),
            "bass_weight": item.get("bass_weight", ""),
            "percussive_ratio": item.get("percussive_ratio", ""),
            "genres": " | ".join(item.get("genre_tags", [])),
            "duration_ms": item.get("duration_ms", ""),
            "search_match_type": item.get("search_match_type", ""),
        })
        print(f"[{index:03d}/{len(rows):03d}] {identity.upper() if identity else 'MISS':14s} {row['artist']} — {row['title']}", flush=True)
        time.sleep(0.1)

    columns = list(output[0])
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(output)
    print(json.dumps({"tracks": len(rows), "matches": sum(row["matched"] == "true" for row in output), "output": str(OUTPUT)}))


if __name__ == "__main__":
    main()
