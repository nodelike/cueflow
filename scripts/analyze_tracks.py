#!/usr/bin/env python3
"""Analyze full local recordings into Cueflow's temporal-analysis contract.

Input manifest:

    {"tracks": [{"trackId": "spotify-or-catalog-id", "path": "/abs/file.wav"}]}

The output is importable with `make analysis-import FILE=...`. This analyzer is
deliberately full-file only: Cueflow's database import checks its measured
duration against the catalog and rejects short preview substitutions.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf


SCHEMA_VERSION = 1
ANALYZER_VERSION = "cueflow-librosa/1.0.0"
ANALYSIS_SAMPLE_RATE = 22_050
HOP_LENGTH = 512
BEAT_HOP_LENGTH = 128
FRAME_SECONDS = 2.0
WAVEFORM_BUCKET_SECONDS = 0.1
PHRASE_BARS = 16


def bounded(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return float(np.clip(np.nan_to_num(value, nan=minimum, posinf=maximum, neginf=minimum), minimum, maximum))


def rounded(value: float, places: int = 6) -> float:
    return round(float(value), places)


def file_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def normalize_curve(values: np.ndarray) -> np.ndarray:
    values = np.nan_to_num(np.asarray(values, dtype=float))
    if values.size == 0:
        return values
    low, high = np.percentile(values, [5, 95])
    if high <= low + 1e-12:
        return np.zeros_like(values)
    return np.clip((values - low) / (high - low), 0, 1)


def loudness_lufs(signal: np.ndarray, sample_rate: int, meter: pyln.Meter) -> float:
    if signal.size < int(sample_rate * 0.4) or float(np.max(np.abs(signal), initial=0)) < 1e-8:
        return -120.0
    try:
        value = float(meter.integrated_loudness(signal))
    except (ValueError, OverflowError):
        value = -120.0
    return bounded(value, -120, 24)


def waveform_envelope(signal: np.ndarray, sample_rate: int, duration: float) -> list[dict[str, float]]:
    bucket_samples = max(1, int(round(WAVEFORM_BUCKET_SECONDS * sample_rate)))
    result: list[dict[str, float]] = []
    for start_sample in range(0, len(signal), bucket_samples):
        end_sample = min(len(signal), start_sample + bucket_samples)
        window = signal[start_sample:end_sample]
        start = start_sample / sample_rate
        end = min(duration, end_sample / sample_rate)
        if end <= start:
            continue
        rms = math.sqrt(float(np.mean(window * window))) if window.size else 0.0
        peak = float(np.max(np.abs(window), initial=0))
        result.append({
            "startSeconds": rounded(start),
            "endSeconds": rounded(end),
            "rms": rounded(bounded(rms)),
            "peak": rounded(bounded(max(rms, peak))),
        })
    return result


def beat_grid(signal: np.ndarray, sample_rate: int) -> tuple[float, float, list[dict[str, Any]], np.ndarray, np.ndarray]:
    onset = librosa.onset.onset_strength(y=signal, sr=sample_rate, hop_length=BEAT_HOP_LENGTH)
    tempo_raw, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset, sr=sample_rate, hop_length=BEAT_HOP_LENGTH, trim=False
    )
    tempo = float(np.asarray(tempo_raw).reshape(-1)[0])
    while 0 < tempo < 70:
        tempo *= 2
    while tempo > 180:
        tempo /= 2
    beat_frames = np.asarray(beat_frames, dtype=int)
    if beat_frames.size < 2:
        raise ValueError("beat tracker found fewer than two beats")
    beat_times = librosa.frames_to_time(beat_frames, sr=sample_rate, hop_length=BEAT_HOP_LENGTH)
    intervals = np.diff(beat_times)
    interval_cv = float(np.std(intervals) / (np.mean(intervals) + 1e-9))
    strengths = onset[np.clip(beat_frames, 0, max(0, len(onset) - 1))]
    strength_norm = normalize_curve(strengths)
    phase_scores = [float(np.mean(strength_norm[phase::4])) for phase in range(4)]
    downbeat_phase = int(np.argmax(phase_scores))
    confidence = bounded(0.92 - interval_cv * 2.5) * 0.75 + bounded(float(np.mean(strength_norm))) * 0.25
    confidence = bounded(confidence)

    beats: list[dict[str, Any]] = []
    for index, (time_value, local_strength) in enumerate(zip(beat_times, strength_norm, strict=True)):
        beat_in_bar = ((index - downbeat_phase) % 4) + 1
        bar_index = max(0, (index - downbeat_phase + 3) // 4)
        beats.append({
            "timeSeconds": rounded(time_value),
            "beatInBar": beat_in_bar,
            "barIndex": bar_index,
            "confidence": rounded(bounded(confidence * 0.75 + float(local_strength) * 0.25)),
        })
    return tempo, confidence, beats, onset, beat_frames


def frame_features(signal: np.ndarray, sample_rate: int, duration: float) -> list[dict[str, Any]]:
    magnitude = np.abs(librosa.stft(signal, n_fft=2048, hop_length=HOP_LENGTH))
    power = magnitude**2
    frequencies = librosa.fft_frequencies(sr=sample_rate, n_fft=2048)
    frame_times = librosa.frames_to_time(np.arange(magnitude.shape[1]), sr=sample_rate, hop_length=HOP_LENGTH)
    harmonic, percussive = librosa.decompose.hpss(magnitude)
    chroma = librosa.feature.chroma_stft(S=power, sr=sample_rate)
    spectral_flux = np.mean(np.maximum(0, np.diff(magnitude, axis=1, prepend=magnitude[:, :1])), axis=0)
    spectral_flux = normalize_curve(spectral_flux)
    total = np.sum(power, axis=0) + 1e-12
    low = np.sum(power[frequencies < 250], axis=0) / total
    mid = np.sum(power[(frequencies >= 250) & (frequencies < 4000)], axis=0) / total
    high = np.sum(power[frequencies >= 4000], axis=0) / total
    harmonic_power = np.sum(harmonic**2, axis=0)
    percussive_power = np.sum(percussive**2, axis=0)
    percussive_share = percussive_power / (harmonic_power + percussive_power + 1e-12)
    tonal_share = harmonic_power / (harmonic_power + percussive_power + 1e-12)
    meter = pyln.Meter(sample_rate)

    result: list[dict[str, Any]] = []
    start = 0.0
    while start < duration:
        end = min(duration, start + FRAME_SECONDS)
        spectrum_mask = (frame_times >= start) & (frame_times < end)
        if not np.any(spectrum_mask):
            spectrum_mask[np.argmin(np.abs(frame_times - start))] = True
        sample_start = int(round(start * sample_rate))
        sample_end = min(len(signal), int(round(end * sample_rate)))
        window = signal[sample_start:sample_end]
        rms = math.sqrt(float(np.mean(window * window))) if window.size else 0.0
        peak = float(np.max(np.abs(window), initial=0))
        tonal = bounded(float(np.mean(tonal_share[spectrum_mask])))
        mid_energy = bounded(float(np.mean(mid[spectrum_mask])))
        # This is a conservative vocal-likelihood proxy, not source separation.
        vocal_probability = bounded(1.7 * tonal * mid_energy - 0.12)
        local_chroma = np.mean(chroma[:, spectrum_mask], axis=1)
        chroma_peak = float(np.max(local_chroma, initial=0))
        if chroma_peak > 0:
            local_chroma = local_chroma / chroma_peak
        result.append({
            "startSeconds": rounded(start),
            "endSeconds": rounded(end),
            "rms": rounded(bounded(rms)),
            "peak": rounded(bounded(max(rms, peak))),
            "loudnessLufs": rounded(loudness_lufs(window, sample_rate, meter), 3),
            "lowEnergy": rounded(bounded(float(np.mean(low[spectrum_mask])))),
            "midEnergy": rounded(mid_energy),
            "highEnergy": rounded(bounded(float(np.mean(high[spectrum_mask])))),
            "spectralFlux": rounded(bounded(float(np.mean(spectral_flux[spectrum_mask])))),
            "percussiveStrength": rounded(bounded(float(np.mean(percussive_share[spectrum_mask])))),
            "vocalProbability": rounded(vocal_probability),
            "tonalStrength": rounded(tonal),
            "chroma": [rounded(bounded(value)) for value in local_chroma],
        })
        start = end
    return result


def aggregate_metrics(frames: list[dict[str, Any]], start: float, end: float) -> dict[str, Any]:
    selected = [frame for frame in frames if frame["endSeconds"] > start and frame["startSeconds"] < end]
    if not selected:
        selected = [min(frames, key=lambda frame: abs(frame["startSeconds"] - start))]
    names = ["lowEnergy", "midEnergy", "highEnergy", "percussiveStrength", "vocalProbability", "tonalStrength"]
    chroma = np.mean(np.asarray([frame["chroma"] for frame in selected]), axis=0)
    chroma_peak = float(np.max(chroma, initial=0))
    if chroma_peak > 0:
        chroma = chroma / chroma_peak
    return {
        "loudnessLufs": rounded(float(np.mean([frame["loudnessLufs"] for frame in selected])), 3),
        "peak": rounded(bounded(max(frame["peak"] for frame in selected))),
        **{name: rounded(bounded(float(np.mean([frame[name] for frame in selected])))) for name in names},
        "chroma": [rounded(bounded(value)) for value in chroma],
    }


def section_map(frames: list[dict[str, Any]], beats: list[dict[str, Any]], duration: float) -> list[dict[str, Any]]:
    downbeats = [beat for beat in beats if beat["beatInBar"] == 1]
    boundaries = [0.0]
    boundaries.extend(float(beat["timeSeconds"]) for beat in downbeats[32::32])
    boundaries.append(duration)
    boundaries = sorted(set(round(value, 6) for value in boundaries if 0 <= value <= duration))
    if boundaries[-1] != duration:
        boundaries.append(duration)
    global_energy = float(np.median([frame["rms"] + frame["percussiveStrength"] for frame in frames]))
    result: list[dict[str, Any]] = []
    for index, (start, end) in enumerate(zip(boundaries, boundaries[1:])):
        if end <= start:
            continue
        metrics = aggregate_metrics(frames, start, end)
        local_energy = float(np.mean([frame["rms"] + frame["percussiveStrength"] for frame in frames if frame["endSeconds"] > start and frame["startSeconds"] < end]))
        if index == 0:
            label = "intro"
        elif index == len(boundaries) - 2:
            label = "outro"
        elif local_energy < global_energy * 0.72:
            label = "breakdown"
        elif metrics["percussiveStrength"] > 0.68 and metrics["lowEnergy"] > 0.28:
            label = "drop"
        else:
            label = "body"
        result.append({
            "id": f"section-{index:03d}", "label": label,
            "startSeconds": rounded(start), "endSeconds": rounded(end), "confidence": 0.72,
        })
    return result


def cue_candidates(frames: list[dict[str, Any]], beats: list[dict[str, Any]], duration: float, tempo_confidence: float) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    beat_times = np.asarray([beat["timeSeconds"] for beat in beats], dtype=float)
    downbeat_indices = [index for index, beat in enumerate(beats) if beat["beatInBar"] == 1]
    phrase_beats = PHRASE_BARS * 4
    windows: list[tuple[int, int, float, float, dict[str, Any], float]] = []
    for beat_index in downbeat_indices:
        end_index = beat_index + phrase_beats
        if end_index >= len(beats):
            continue
        start, end = float(beat_times[beat_index]), float(beat_times[end_index])
        if end > duration or end <= start:
            continue
        metrics = aggregate_metrics(frames, start, end)
        cleanliness = bounded(
            (1 - metrics["vocalProbability"]) * 0.45
            + metrics["percussiveStrength"] * 0.30
            + (1 - metrics["lowEnergy"]) * 0.25
        )
        windows.append((beat_index, beats[beat_index]["barIndex"], start, end, metrics, cleanliness))
    if not windows:
        raise ValueError(f"recording has no complete {PHRASE_BARS}-bar phrase windows")

    def add(kind: str, window: tuple[int, int, float, float, dict[str, Any], float], reason: str) -> None:
        beat_index, bar_index, start, end, metrics, cleanliness = window
        identity = f"{kind}-{bar_index:04d}"
        if any(candidate["id"] == identity for candidate in candidates):
            return
        candidates.append({
            "id": identity,
            "kind": kind,
            "startSeconds": rounded(start),
            "endSeconds": rounded(end),
            "beatIndex": beat_index,
            "barIndex": bar_index,
            "bars": PHRASE_BARS,
            "confidence": rounded(bounded(tempo_confidence * 0.55 + cleanliness * 0.45)),
            "metrics": metrics,
            "reasons": [reason, "16-bar window begins on an estimated downbeat"],
        })

    incoming = sorted((window for window in windows if window[2] <= duration * 0.35), key=lambda item: item[5], reverse=True)[:3]
    outgoing = sorted((window for window in windows if window[2] >= duration * 0.55), key=lambda item: item[5], reverse=True)[:3]
    for window in incoming:
        add("intro" if window[2] <= duration * 0.12 else "phrase-in", window, "early clean phrase ranked for mix-in")
    for window in outgoing:
        add("outro" if window[2] >= duration * 0.78 else "phrase-out", window, "late clean phrase ranked for mix-out")

    interior = [window for window in windows if duration * 0.2 <= window[2] <= duration * 0.8]
    if interior:
        breakdown = min(interior, key=lambda item: item[4]["lowEnergy"] + item[4]["percussiveStrength"])
        add("breakdown", breakdown, "local low-band/percussive minimum")
        drop = max(interior, key=lambda item: item[4]["lowEnergy"] + item[4]["percussiveStrength"])
        add("drop", drop, "local low-band/percussive maximum")
    return sorted(candidates, key=lambda cue: (cue["startSeconds"], cue["kind"]))


def analyze_track(track_id: str, path: Path) -> dict[str, Any]:
    if not track_id.strip():
        raise ValueError("trackId is required")
    if not path.is_file():
        raise FileNotFoundError(path)
    source_info = sf.info(path)
    audio, sample_rate = librosa.load(path, sr=ANALYSIS_SAMPLE_RATE, mono=False)
    channels = int(source_info.channels)
    signal = audio if audio.ndim == 1 else np.mean(audio, axis=0)
    signal = np.asarray(signal, dtype=np.float64)
    duration = len(signal) / sample_rate
    if duration < 30:
        raise ValueError("full-track analysis requires at least 30 seconds of audio")
    tempo, tempo_confidence, beats, _, _ = beat_grid(signal, sample_rate)
    frames = frame_features(signal, sample_rate, duration)
    cues = cue_candidates(frames, beats, duration, tempo_confidence)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "trackId": track_id,
        "audioFingerprint": file_fingerprint(path),
        "analyzerVersion": ANALYZER_VERSION,
        "durationSeconds": rounded(duration),
        "sampleRate": sample_rate,
        "channels": channels,
        "tempoBpm": rounded(tempo, 3),
        "tempoConfidence": rounded(tempo_confidence),
        "waveform": waveform_envelope(signal, sample_rate, duration),
        "beats": beats,
        "sections": section_map(frames, beats, duration),
        "frames": frames,
        "cueCandidates": cues,
        "analyzedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def load_manifest(path: Path) -> list[tuple[str, Path]]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if set(payload) != {"tracks"} or not isinstance(payload["tracks"], list) or not payload["tracks"]:
        raise ValueError('manifest must be {"tracks": [{"trackId": ..., "path": ...}]}')
    result: list[tuple[str, Path]] = []
    seen: set[str] = set()
    for index, item in enumerate(payload["tracks"]):
        if not isinstance(item, dict) or set(item) != {"trackId", "path"}:
            raise ValueError(f"tracks[{index}] must contain exactly trackId and path")
        track_id = str(item["trackId"]).strip()
        if track_id in seen:
            raise ValueError(f"duplicate trackId {track_id!r}")
        seen.add(track_id)
        result.append((track_id, Path(item["path"]).expanduser().resolve()))
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    tracks = load_manifest(args.manifest)
    analyses: list[dict[str, Any]] = []
    for index, (track_id, path) in enumerate(tracks, 1):
        print(f"[{index:03d}/{len(tracks):03d}] analyzing {track_id}: {path}", flush=True)
        analysis = analyze_track(track_id, path)
        analyses.append(analysis)
    output = {"analyses": analyses}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_path = tempfile.mkstemp(prefix=args.output.name + ".", dir=args.output.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(output, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write("\n")
        os.replace(temporary_path, args.output)
    except BaseException:
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        raise
    print(json.dumps({"tracks": len(analyses), "output": str(args.output), "analyzerVersion": ANALYZER_VERSION}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
