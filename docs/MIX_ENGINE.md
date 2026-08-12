# Cueflow mix-engine contract

For the source-linked research audit, current-system rating, recommended audio
architecture, evaluation program, and phased roadmap, see
[AUTOMATED_DJ_MIXING_RESEARCH.md](AUTOMATED_DJ_MIXING_RESEARCH.md). This file
remains the concise contract for behavior implemented in Cueflow today.

Cueflow deliberately separates three claims that used to be blurred together:

1. `metadata-only`: global BPM, Camelot key, energy, groove label, vocal
   estimate, and provenance confidence. Useful for ordering; insufficient to
   claim a blend works.
2. `temporal`: both full recordings have versioned waveform/STFT/beat/section
   analysis and the planner selected concrete exit and entry windows. Useful
   for an executable transition proposal; still not proof of sound quality.
3. `rendered`: the proposed overlap has been rendered and passed clipping,
   loudness, masking, phase, time-stretch, and artifact checks. This stage is
   designed but not implemented yet.

The UI and JSON payload expose the evidence basis on every transition. The
overall number remains wire-compatible as `qualityScore`, but its visible name
is **heuristic fit** and its algorithm version is stored in `scoreVersion`.

## Set ordering

The generator is a deterministic beam search (42 states, 14 branches per
state). Each state tracks the complete sequence, used tracks, elapsed
full-track duration, transition evidence, and cumulative score. Candidate
ranking currently combines:

| Signal | Weight | Meaning |
| --- | ---: | --- |
| Previous edge | 45% | Metadata or temporal transition score |
| Energy-arc fit | 22% | Track energy against the requested arc at elapsed time |
| BPM-curve fit | 24% | Relative tempo compatibility with the requested endpoint curve |
| Set role | 9% | Opener/builder/bridge/lifter/peak/reset/closer placement |

Confidence, medium/high transition risk, repeated artists, previously reused
edges, and reused tracks apply explicit penalties. Required tracks receive a
bonus but must still fit the duration envelope. A result is valid only within
90–110% of the requested full-track duration. This duration is not the future
mixed runtime because overlaps have not yet been subtracted; `durationBasis`
makes that limitation explicit.

Tempo similarity uses the smallest proportional adjustment among direct,
half-time, and double-time interpretations:

```text
tempo_score = exp(-adjustment_percent / 6.5)
```

The chosen octave interpretation is recorded and never presented as a verified
beat-grid lock.

## Draft heuristic fit

The version `heuristic-fit-v2` combines:

| Signal | Weight |
| --- | ---: |
| Energy-arc fit | 20% |
| Tempo flow | 15% |
| Harmonic flow | 12% |
| Catalog diversity | 8% |
| Duration fit | 15% |
| Ending role | 8% |
| Weak-link transition safety | 17% |
| Analysis confidence | 5% |

Transition safety is not a mean. It weights the 10th-percentile edge 60% and
the weakest edge 40%, so a train wreck cannot disappear inside ten safe
transitions. Any high-risk edge caps the total heuristic fit at 74; additional
high-risk edges lower the cap. Drafts expose `weakestTransition`,
`highRiskTransitions`, `analysisConfidence`, `temporalCoverage`, and
`temporalConfidence` directly.

## Full-track waveform pipeline

`scripts/analyze_tracks.py` consumes local full recordings and emits schema
version 1. The import is strict: unknown fields, invalid ranges, overlapping
waveform buckets, unordered beats, bad cue windows, duplicate identities, and
preview-length duration mismatches fail the whole batch.

The analyzer produces:

- SHA-256 source-audio fingerprint and analyzer version;
- 100 ms RMS/peak waveform-envelope buckets;
- onset-derived tempo, beat markers, estimated four-beat bar phase, and local
  beat confidence;
- coarse structural sections aligned to bar boundaries;
- two-second time-local frames containing RMS, peak, LUFS, low/mid/high-band
  shares, spectral flux, harmonic/percussive balance, a conservative vocal
  likelihood proxy, tonal strength, and 12-bin chroma;
- ranked 16-bar `intro`, `phrase-in`, `breakdown`, `drop`, `phrase-out`, and
  `outro` cue windows with aggregated local metrics and reasons.

The vocal value is currently a signal-processing proxy, not neural source
separation. The downbeat phase is estimated from beat accents, not a
state-of-the-art downbeat model. Their confidence therefore gates risk instead
of being treated as ground truth.

## Cue-pair scoring and transition plans

For every candidate edge with analysis on both sides, the planner evaluates all
compatible outgoing/incoming cue pairs. `cue-plan-v1` uses:

| Window signal | Weight | Failure it targets |
| --- | ---: | --- |
| Analyzed tempo | 15% | Excessive stretch or octave mistake |
| Phrase/bar match | 17% | Misaligned musical sentences |
| Low-band overlap | 14% | Two kicks/basslines fighting |
| Vocal overlap | 17% | Lead-vocal collision |
| Loudness match | 11% | Perceptual jump and gain mismatch |
| Percussive continuity | 8% | Groove discontinuity |
| Local chroma | 8% | Tonal clash inside the actual overlap |
| Waveform-peak headroom | 10% | Predicted midpoint clipping pressure |

Cue/analyzer confidence scales the result. The best pair becomes a concrete
plan containing both time ranges, number of bars, transition style, bass-swap
bar, incoming trim, and automation lanes for crossfader, outgoing low EQ,
incoming low EQ, and incoming trim. Styles currently include `long-blend`,
`bass-swap`, `echo-out`, `drum-led`, and `drop-swap`.

The temporal plan and metadata score are combined 62/38. Risk can only stay the
same or become more severe after applying tempo movement, cue confidence,
window score, and vocal collision gates. Mixed-evidence drafts report partial
`temporalCoverage`; missing analysis falls back per edge instead of silently
pretending the waveform was considered.

## What is still required for festival-grade output

The current code can order tracks and propose exact, automation-ready
transitions. It still cannot honestly claim “Tomorrowland level” output because
it does not produce or audition audio. The next engineering stages are:

1. Add a deterministic renderer (FFmpeg/Rubber Band or a DAW-grade time-stretch
   engine) that applies cue timing, beat-grid correction, gain, EQ, filters,
   crossfader curves, and style-specific effects.
2. Analyze the rendered overlap for true peak, short-term/integrated loudness,
   low-band masking, phase correlation, transient smearing, spectral holes,
   vocal bleed, and stretch artifacts; reject or re-plan failures.
3. Replace the vocal proxy and accent-based downbeat estimator with validated
   source-separation, vocal-activity, beat/downbeat, and structural models.
4. Add transition diversity and narrative constraints so a set develops motifs,
   tension/release, resets, surprise records, and signature moments instead of
   optimizing every edge independently.
5. Calibrate scores against blinded DJ ratings and rendered A/B tests. Until
   then, numerical thresholds are engineering priors, not crowd-response truth.
6. Add final set rendering, loudness/true-peak mastering, rehearsal reports,
   and export formats for the target DJ platform.

That validation loop—not a larger metadata weight table—is what turns a good
set sequencer into a credible automatic mix engine.
