import { Disc3, PanelLeft, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDate, formatDuration } from '../lib/format'
import { getSavedBriefOpen, saveBriefOpen } from '../lib/preferences'
import type { GenerateRequest, Section, SetDraft, SourcePlaylist, Track, TransitionFeedback, TransitionVerdict } from '../types'
import { BriefPanel } from '../components/studio/BriefPanel'
import { MixSheet, transitionKey } from '../components/studio/MixSheet'
import { TrackInspector } from '../components/studio/TrackInspector'
import { WaveformDeck } from '../components/studio/WaveformDeck'
import { SectionHeader } from '../components/shell/SectionHeader'

type Props = {
  drafts: SetDraft[]
  selectedDraft: number
  selectedPosition: number
  request: GenerateRequest
  tracks: Track[]
  crates: SourcePlaylist[]
  eligibleCount: number
  feedback: Map<string, TransitionFeedback>
  savingTransition: string
  spotifyReady: boolean
  busy: boolean
  onRequestChange: (request: GenerateRequest) => void
  onGenerate: () => void
  onPublish: () => void
  onSelectDraft: (index: number) => void
  onSelectPosition: (position: number) => void
  onFeedback: (fromTrackId: string, toTrackId: string, verdict: TransitionVerdict) => void
  onNavigate: (section: Section) => void
}

export function StudioView(props: Props) {
  const { drafts, selectedDraft, selectedPosition, feedback, spotifyReady, busy } = props
  const [briefOpen, setBriefOpen] = useState(getSavedBriefOpen)

  useEffect(() => { saveBriefOpen(briefOpen) }, [briefOpen])

  // ⌘B collapses the brief once a set exists and the sheet wants the room.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setBriefOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const draft = drafts[selectedDraft]
  const item = draft?.tracks.find((entry) => entry.position === selectedPosition) ?? draft?.tracks[0]
  const nextItem = item && draft?.tracks.find((entry) => entry.position === item.position + 1)
  const previousItem = item && draft?.tracks.find((entry) => entry.position === item.position - 1)

  const subtitle = draft
    ? `${draft.arc} · ${formatDuration(draft.durationSeconds)} · ${draft.tracks.length} tracks · ${draft.temporalCoverage > 0
      ? `${Math.round(draft.temporalCoverage)}% cue-window coverage`
      : 'metadata-only evidence'} · generated ${formatDate(draft.createdAt)}`
    : 'Set your brief, then generate a few directions to compare.'

  return (
    <div className="section">
      <SectionHeader title={draft ? draft.name : 'Studio'} subtitle={subtitle}>
        <button
          type="button"
          className="btn icon ghost"
          aria-pressed={briefOpen}
          aria-label={`${briefOpen ? 'Hide' : 'Show'} the brief panel`}
          title={`${briefOpen ? 'Hide' : 'Show'} the brief panel (⌘B)`}
          onClick={() => setBriefOpen((current) => !current)}
        >
          <PanelLeft size={15} />
        </button>
        {draft && (
          <>
            <div className="segmented" role="tablist" aria-label="Set variations">
              {drafts.map((option, index) => (
                <button
                  type="button"
                  role="tab"
                  key={option.id}
                  aria-selected={selectedDraft === index}
                  onClick={() => props.onSelectDraft(index)}
                  title={`Variation ${String.fromCharCode(65 + index)} · quality ${option.qualityScore}`}
                >
                  {String.fromCharCode(65 + index)}
                  <b className="num">{Math.round(option.qualityScore)}</b>
                </button>
              ))}
            </div>
            <div className="quality" title="Metadata-based heuristic fit; this is not a rendered-audio quality score">
              <strong className="num">{draft.qualityScore}</strong>
              <span>fit</span>
            </div>
            <button type="button" className="btn" disabled={!spotifyReady || busy} onClick={props.onPublish}>
              <Send size={14} /> Publish
            </button>
          </>
        )}
      </SectionHeader>

      <div className={`section-body studio${briefOpen ? '' : ' brief-collapsed'}`}>
        <BriefPanel
          value={props.request}
          tracks={props.tracks}
          crates={props.crates}
          eligibleCount={props.eligibleCount}
          busy={busy}
          onChange={props.onRequestChange}
          onGenerate={props.onGenerate}
          onNavigate={props.onNavigate}
        />

        {!draft ? (
          <div className="studio-empty">
            <div className="empty">
              <Disc3 size={30} />
              <h2>No set yet</h2>
              <p>Pick your crates and constraints on the left, then generate variations to compare side by side.</p>
              <button type="button" className="btn primary" onClick={props.onGenerate} disabled={busy}>
                <Sparkles size={15} /> Generate set
              </button>
            </div>
          </div>
        ) : (
          <div className="canvas">
            <div className="canvas-scores">
              <Score label="Energy" value={draft.energyFit} />
              <Score label="Harmony" value={draft.harmonicFlow} />
              <Score label="Tempo" value={draft.tempoFlow} />
              <Score label="Safety" value={draft.transitionSafety} />
              <Score label="Diversity" value={draft.diversity} />
            </div>
            <WaveformDeck item={item} nextItem={nextItem} />
            <div className="canvas-main">
              <MixSheet
                draft={draft}
                selectedPosition={item?.position ?? 1}
                feedback={feedback}
                savingTransition={props.savingTransition}
                onSelect={props.onSelectPosition}
                onFeedback={props.onFeedback}
              />
              <TrackInspector
                item={item}
                nextItem={nextItem}
                incomingFeedback={previousItem && item ? feedback.get(transitionKey(previousItem.track.id, item.track.id)) : undefined}
                outgoingFeedback={item && nextItem ? feedback.get(transitionKey(item.track.id, nextItem.track.id)) : undefined}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="score">
      <span className="eyebrow">{label}</span>
      <strong className="num">{Math.round(value)}</strong>
      <i><b style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>
    </div>
  )
}
