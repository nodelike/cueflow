#!/usr/bin/env python3
"""Analyze Spotify's public 30-second previews for Cueflow's research queue.

This is a research helper, not an authoritative tag importer. It produces a
CSV for review/cross-checking and never mutates PostgreSQL or Spotify.
"""

from __future__ import annotations

import csv
import io
import json
import getpass
import math
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import requests


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgres://{getpass.getuser()}@127.0.0.1:5432/cueflow?sslmode=disable",
)
OUTPUT = Path("research/preview-analysis.csv")
PREVIEW_PATTERN = re.compile(r'"audioPreview":\{"url":"([^"]+)"')

MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MINOR_CAMELOT = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"]
MAJOR_CAMELOT = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"]


@dataclass
class Track:
    track_id: str
    spotify_id: str
    title: str
    artist: str
    duration: int
    playlists: str


def catalog() -> list[Track]:
    query = """
    SELECT t.id,t.spotify_id,t.title,t.artist,t.duration_seconds,
           string_agg(p.name,' | ' ORDER BY p.kind,p.name)
    FROM tracks t
    JOIN playlist_tracks pt ON pt.track_id=t.id
    JOIN spotify_playlists p ON p.id=pt.playlist_id
    WHERE t.spotify_uri<>''
    GROUP BY t.id,t.spotify_id,t.title,t.artist,t.duration_seconds
    ORDER BY t.added_at,t.id
    """
    result = subprocess.run(
        ["psql", DATABASE_URL, "-At", "-F", "\t", "-c", query],
        check=True,
        capture_output=True,
        text=True,
    )
    return [Track(row[0], row[1], row[2], row[3], int(row[4]), row[5]) for row in csv.reader(io.StringIO(result.stdout), delimiter="\t")]


def preview_url(session: requests.Session, spotify_id: str) -> str:
    response = session.get(f"https://open.spotify.com/embed/track/{spotify_id}", timeout=20)
    response.raise_for_status()
    match = PREVIEW_PATTERN.search(response.text)
    return match.group(1).replace("\\u0026", "&") if match else ""


def key_estimate(chroma: np.ndarray) -> tuple[str, str, float]:
    observed = np.mean(chroma, axis=1)
    if not np.any(observed):
        return "", "", 0.0
    observed = (observed - np.mean(observed)) / (np.std(observed) + 1e-9)
    candidates: list[tuple[float, int, str]] = []
    for root in range(12):
        for mode, profile in (("major", MAJOR_PROFILE), ("minor", MINOR_PROFILE)):
            rotated = np.roll(profile, root)
            score = float(np.corrcoef(observed, rotated)[0, 1])
            candidates.append((score, root, mode))
    candidates.sort(reverse=True)
    score, root, mode = candidates[0]
    margin = score - candidates[1][0]
    confidence = float(np.clip(0.45 + score * 0.25 + margin * 0.6, 0.25, 0.88))
    key = f"{NOTES[root]} {'major' if mode == 'major' else 'minor'}"
    camelot = MAJOR_CAMELOT[root] if mode == "major" else MINOR_CAMELOT[root]
    return key, camelot, confidence


def tempo_estimate(signal: np.ndarray, sample_rate: int, playlists: str) -> float:
    hop_length = 128
    onset = librosa.onset.onset_strength(y=signal, sr=sample_rate, hop_length=hop_length)
    onset -= np.mean(onset)
    autocorrelation = librosa.autocorrelate(onset, max_size=len(onset))
    low, high = 108.0, 138.0
    if "Techno Vibezz" in playlists:
        low, high = 118.0, 155.0
    elif "Tech House Vibezz" in playlists:
        low, high = 118.0, 140.0
    elif "House Vibezz" in playlists:
        low, high = 112.0, 138.0
    candidates = np.arange(low, high + 0.01, 0.02)
    lags = 60 * sample_rate / (hop_length * candidates)
    scores = np.interp(lags, np.arange(len(autocorrelation)), autocorrelation)
    return float(round(candidates[int(np.argmax(scores))]))


def analyze(audio: bytes, playlists: str) -> dict[str, float | str]:
    signal, sample_rate = librosa.load(io.BytesIO(audio), sr=22050, mono=True)
    signal, _ = librosa.effects.trim(signal, top_db=42)
    tempo_value = tempo_estimate(signal, sample_rate, playlists)
    chroma = librosa.feature.chroma_cqt(y=signal, sr=sample_rate)
    musical_key, camelot, key_confidence = key_estimate(chroma)
    rms = librosa.feature.rms(y=signal)[0]
    onset = librosa.onset.onset_strength(y=signal, sr=sample_rate)
    harmonic, percussive = librosa.effects.hpss(signal)
    total_power = float(np.mean(signal**2)) + 1e-9
    harmonic_share = float(np.mean(harmonic**2) / total_power)
    percussive_share = float(np.mean(percussive**2) / total_power)
    dynamic_range = float(np.percentile(rms, 90) - np.percentile(rms, 10))
    return {
        "bpm": round(tempo_value, 2),
        "musical_key": musical_key,
        "camelot": camelot,
        "key_confidence": round(key_confidence, 3),
        "rms": float(np.mean(rms)),
        "onset": float(np.mean(onset)),
        "harmonic_share": harmonic_share,
        "percussive_share": percussive_share,
        "dynamic_range": dynamic_range,
        "preview_seconds": round(len(signal) / sample_rate, 2),
    }


def normalize(values: list[float], value: float, low: float = 0.2, high: float = 0.96) -> float:
    order = np.sort(np.asarray(values))
    rank = float(np.searchsorted(order, value, side="right") / max(1, len(order)))
    return round(low + rank * (high - low), 3)


def groove(playlists: str, bpm: float, percussive_share: float) -> str:
    sources = set(playlists.split(" | "))
    if "Techno Vibezz" in sources and (bpm >= 125 or "Afro Vibezz" not in sources):
        return "techno"
    if "Tech House Vibezz" in sources and bpm >= 123:
        return "tech-house"
    if "Afro Vibezz" in sources:
        return "tribal" if percussive_share > 0.42 else "afro"
    if "House Vibezz" in sources:
        return "house"
    return "house"


def role(energy: float, vocal: float, dynamic_range: float) -> str:
    if vocal > 0.72:
        return "vocal"
    if energy < 0.32:
        return "opener"
    if dynamic_range > 0.08 and 0.45 < energy < 0.75:
        return "bridge"
    if energy < 0.56:
        return "builder"
    if energy < 0.76:
        return "lifter"
    return "peak"


def main() -> int:
    tracks = catalog()
    session = requests.Session()
    session.headers["User-Agent"] = "Cueflow personal research/1.0"
    raw: list[dict[str, object]] = []
    for index, track in enumerate(tracks, 1):
        try:
            url = preview_url(session, track.spotify_id)
            if not url:
                raise RuntimeError("preview unavailable")
            audio = session.get(url, timeout=30).content
            metrics = analyze(audio, track.playlists)
            raw.append({"track": track, "preview_url": url, **metrics})
            print(f"[{index:03d}/{len(tracks):03d}] {track.artist} — {track.title}", flush=True)
        except Exception as exc:
            print(f"[{index:03d}/{len(tracks):03d}] ERROR {track.spotify_id}: {exc}", file=sys.stderr, flush=True)

    rms_values = [float(row["rms"]) for row in raw]
    onset_values = [float(row["onset"]) for row in raw]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "track_id", "spotify_id", "title", "artist", "duration_seconds", "playlists", "bpm", "musical_key", "camelot",
        "energy", "groove", "vocal", "role", "key_confidence", "preview_seconds", "dynamic_range",
        "harmonic_share", "percussive_share", "preview_url", "analysis_source",
    ]
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in raw:
            track = row["track"]
            assert isinstance(track, Track)
            energy = round(
                0.68 * normalize(rms_values, float(row["rms"]))
                + 0.32 * normalize(onset_values, float(row["onset"])),
                3,
            )
            harmonic = float(row["harmonic_share"])
            vocal = round(float(np.clip((harmonic - 0.25) / 0.65, 0.04, 0.88)), 3)
            selected_groove = groove(track.playlists, float(row["bpm"]), float(row["percussive_share"]))
            writer.writerow({
                "track_id": track.track_id,
                "spotify_id": track.spotify_id,
                "title": track.title,
                "artist": track.artist,
                "duration_seconds": track.duration,
                "playlists": track.playlists,
                "bpm": row["bpm"],
                "musical_key": row["musical_key"],
                "camelot": row["camelot"],
                "energy": energy,
                "groove": selected_groove,
                "vocal": vocal,
                "role": role(energy, vocal, float(row["dynamic_range"])),
                "key_confidence": row["key_confidence"],
                "preview_seconds": row["preview_seconds"],
                "dynamic_range": round(float(row["dynamic_range"]), 4),
                "harmonic_share": round(harmonic, 4),
                "percussive_share": round(float(row["percussive_share"]), 4),
                "preview_url": row["preview_url"],
                "analysis_source": "Spotify public 30s preview; librosa 0.11 beat/chroma/HPSS/RMS/onset analysis",
            })
    print(json.dumps({"tracks": len(tracks), "analyzed": len(raw), "output": str(OUTPUT)}))
    return 0 if len(raw) == len(tracks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
