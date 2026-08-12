#!/usr/bin/env python3
"""Merge recording analysis and online cross-checks into an auditable import."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np


PREVIEW = Path("research/preview-analysis.csv")
CROSSCHECK = Path("research/mixgraph-crosscheck.csv")
ENRICHMENT = Path("research/enrichment.csv")
AUDIT = Path("research/research-audit.csv")

KEYS = {
    "1A": "G# minor", "2A": "D# minor", "3A": "A# minor", "4A": "F minor", "5A": "C minor", "6A": "G minor",
    "7A": "D minor", "8A": "A minor", "9A": "E minor", "10A": "B minor", "11A": "F# minor", "12A": "C# minor",
    "1B": "B major", "2B": "F# major", "3B": "C# major", "4B": "G# major", "5B": "D# major", "6B": "A# major",
    "7B": "F major", "8B": "C major", "9B": "G major", "10B": "D major", "11B": "A major", "12B": "E major",
}

# Conflicts cross-checked manually against additional public sources. These are
# deliberately small and documented; the batch does not hide disagreements.
OVERRIDES = {
    "0l7cfP9dZBrkkNkR7NXnQO": {"bpm": 126, "camelot": "5B", "source": "https://www.beatport.com/track/gimme-that-bounce/17394497 | https://www.mixgraph.io/tracks/mau-p-gimme-that-bounce"},
    "6ho0GyrWZN3mhi9zVRW7xi": {"bpm": 125, "camelot": "9B", "source": "https://www.beatport.com/track/losing-it/10766349 | https://www.mixgraph.io/tracks/fisher-losing-it"},
    "3AjSfp5FDvwtMU9XBsbS8j": {"bpm": 150, "camelot": "9B", "source": "https://music.toolstud.io/tracks/bd32-162c/push-up-main-edit | Spotify public preview analysis"},
    "6n9Nhx5nhAPrsnjQpL8zna": {"bpm": 130, "camelot": "6A", "source": "https://www.beatport.com/track/giza/26747145 | Spotify public preview analysis"},
    # The exact 4:39 recording is consistently measured near 101 BPM by
    # SongBPM/Trackify. Beatport's 77 BPM listing is for the shorter radio edit.
    "76952ZbAHlgMqrIEMqYkgB": {"bpm": 101, "camelot": "1A", "source": "https://songbpm.com/%40mikeeysmind/papaoutai-afro-soul-ezdtd | https://trackify.am/track/76952ZbAHlgMqrIEMqYkgB/tempo"},
    # Public catalogs store the Neo Rave record at half-time (77 BPM), while
    # direct onset analysis resolves its DJ beat grid at 154 BPM.
    "5e4II0hLokRNiw4q2uHeL8": {"bpm": 154, "camelot": "4A", "source": "https://www.beatport.com/artist/nico-moreno/665892/tracks | Spotify public preview onset analysis (154 BPM double-time grid)"},
}


def choose_groove(row: dict[str, str], source: dict[str, str]) -> str:
    genre = source.get("genres", "").lower()
    playlists = row["playlists"]
    if "afro house" in genre:
        return "afro"
    if "tech house" in genre or "minimal / deep tech" in genre:
        return "tech-house"
    if "techno" in genre or "melodic house" in genre or "progressive house" in genre:
        return "techno"
    if "house" in genre:
        return "house"
    if "Tech House Vibezz" in playlists:
        return "tech-house"
    if "Techno Vibezz" in playlists and "Afro Vibezz" not in playlists:
        return "techno"
    if "Afro Vibezz" in playlists:
        return "tribal" if float(row["percussive_share"]) > 0.44 else "afro"
    return "house"


def main() -> None:
    preview = list(csv.DictReader(PREVIEW.open(encoding="utf-8")))
    checks = {row["track_id"]: row for row in csv.DictReader(CROSSCHECK.open(encoding="utf-8"))}
    merged: list[dict[str, object]] = []
    for row in preview:
        source = checks[row["track_id"]]
        source_match = source.get("matched") == "true"
        preview_bpm = float(row["bpm"])
        source_bpm = float(source["bpm"]) if source_match and source.get("bpm") else 0
        bpm_agreement = bool(source_bpm and abs(preview_bpm - source_bpm) <= 2)
        bpm = source_bpm if source_bpm else preview_bpm
        source_key = source.get("camelot", "") if source_match else ""
        key_agreement = bool(source_key and source_key == row["camelot"])
        camelot = source_key or row["camelot"]

        source_energy = float(source["energy"]) if source_match and source.get("energy") else 0
        energy = round(source_energy * .65 + float(row["energy"]) * .35, 3) if source_energy else float(row["energy"])
        instrumentalness = float(source["instrumentalness"]) if source_match and source.get("instrumentalness") else -1
        vocal = round(np.clip(1 - instrumentalness, .03, .92), 3) if instrumentalness >= 0 else float(row["vocal"])
        groove = choose_groove(row, source)
        identity = source.get("identity_match", "")
        confidence = .90 if identity == "exact-id" and bpm_agreement and key_agreement else .82 if identity == "exact-id" else .74 if identity == "same-recording" else .64
        evidence = ["Spotify public 30s preview: beat/chroma/HPSS/RMS/onset structural analysis"]
        if source_match:
            evidence.append(f"Mixgraph {identity}: {source['source_url']}")
        else:
            evidence.append(f"Mixgraph exact-title search performed; no exact recording match for Spotify {row['spotify_id']}")

        override = OVERRIDES.get(row["spotify_id"])
        if override:
            bpm = float(override["bpm"])
            camelot = str(override["camelot"])
            confidence = max(confidence, .86)
            evidence.append(f"manual conflict resolution: {override['source']}")

        merged.append({
            **row,
            "preview_bpm": preview_bpm,
            "preview_camelot": row["camelot"],
            "bpm_final": bpm,
            "camelot_final": camelot,
            "musical_key_final": KEYS[camelot],
            "energy_final": energy,
            "groove_final": groove,
            "vocal_final": vocal,
            "confidence_final": round(confidence, 2),
            "evidence": " ; ".join(evidence),
            "identity_match": identity or "preview-only",
            "bpm_agreement": str(bpm_agreement).lower(),
            "key_agreement": str(key_agreement).lower(),
            "source_bpm": source_bpm or "",
            "source_camelot": source_key,
            "source_energy": source_energy or "",
            "source_genres": source.get("genres", ""),
        })

    energies = np.array([float(row["energy_final"]) for row in merged])
    q18, q42, q72, q90 = np.quantile(energies, [.18, .42, .72, .90])
    for row in merged:
        energy, vocal, dynamic = float(row["energy_final"]), float(row["vocal_final"]), float(row["dynamic_range"])
        if vocal >= .64:
            role = "vocal"
        elif energy <= q18:
            role = "opener"
        elif dynamic >= .08 and energy < q72:
            role = "reset"
        elif energy <= q42:
            role = "builder"
        elif energy <= q72:
            role = "bridge"
        elif energy <= q90:
            role = "lifter"
        else:
            role = "peak"
        row["role_final"] = role

    # Give the most spacious lower-energy record in each groove family a closer
    # role; these are candidates, not a claim about artist intent.
    for groove in {str(row["groove_final"]) for row in merged}:
        candidates = [row for row in merged if row["groove_final"] == groove and row["role_final"] in {"builder", "bridge", "vocal"}]
        if candidates:
            selected = max(candidates, key=lambda row: float(row["dynamic_range"]) + int(row["duration_seconds"]) / 10000)
            selected["role_final"] = "closer"

    with ENRICHMENT.open("w", newline="", encoding="utf-8") as handle:
        columns = ["track_id", "bpm", "musical_key", "camelot", "energy", "groove", "vocal", "role", "source", "confidence"]
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in merged:
            writer.writerow({
                "track_id": row["track_id"], "bpm": row["bpm_final"], "musical_key": row["musical_key_final"],
                "camelot": row["camelot_final"], "energy": row["energy_final"], "groove": row["groove_final"],
                "vocal": row["vocal_final"], "role": row["role_final"], "source": row["evidence"], "confidence": row["confidence_final"],
            })
    with AUDIT.open("w", newline="", encoding="utf-8") as handle:
        columns = ["spotify_id", "title", "artist", "playlists", "identity_match", "preview_bpm", "source_bpm", "bpm_final", "bpm_agreement", "preview_camelot", "source_camelot", "musical_key_final", "camelot_final", "key_agreement", "energy_final", "source_energy", "groove_final", "source_genres", "vocal_final", "role_final", "confidence_final", "evidence"]
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(merged)
    print(json.dumps({
        "tracks": len(merged),
        "exact_or_version_matches": sum(row["identity_match"] != "preview-only" for row in merged),
        "bpm_consensus": sum(row["bpm_agreement"] == "true" for row in merged),
        "key_consensus": sum(row["key_agreement"] == "true" for row in merged),
        "preview_only": sum(row["identity_match"] == "preview-only" for row in merged),
        "enrichment": str(ENRICHMENT),
        "audit": str(AUDIT),
    }))


if __name__ == "__main__":
    main()
