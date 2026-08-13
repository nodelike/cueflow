import { Disc3, Send, Sparkles, X } from 'lucide-react'
import { formatDate, formatDuration } from '../lib/format'
import type { GenerateRequest, Section, SetDraft, SourcePlaylist, Track, TransitionFeedback, TransitionVerdict } from '../types'
import { Artwork } from '../components/common/Artwork'
import { Popover } from '../components/common/Popover'
import { BriefBar } from '../components/studio/BriefBar'
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
  tidalReady: boolean
  busy: boolean
  onRequestChange: (request: GenerateRequest) => void
  onGenerate: () => void
  onPublish: () => void
  onPreviewTidal: () => void
  onSelectDraft: (index: number) => void
  onSelectPosition: (position: number) => void
  onFeedback: (fromTrackId: string, toTrackId: string, verdict: TransitionVerdict) => void
  onNavigate: (section: Section) => void
}

export function StudioView(props: Props) {
  const { drafts, selectedDraft, selectedPosition, request, tracks, feedback, spotifyReady, busy } = props
  const draft = drafts[selectedDraft]
  const item = draft?.tracks.find((entry) => entry.position === selectedPosition) ?? draft?.tracks[0]
  const nextItem = item && draft?.tracks.find((entry) => entry.position === item.position + 1)
  const previousItem = item && draft?.tracks.find((entry) => entry.position === item.position - 1)

  const pinned = request.requiredTrackIds
    .map((id) => tracks.find((track) => track.id === id))
    .filter((track): track is Track => Boolean(track))

  function togglePin(trackID: string) {
    const current = request.requiredTrackIds
    props.onRequestChange({
      ...request,
      requiredTrackIds: current.includes(trackID) ? current.filter((id) => id !== trackID) : [...current, trackID],
    })
  }

  const subtitle = draft
    ? `${draft.arc} · ${formatDuration(draft.durationSeconds)} · ${draft.tracks.length} tracks · ${draft.temporalCoverage > 0
      ? `${Math.round(draft.temporalCoverage)}% cue-window coverage`
      : 'metadata-only evidence'} · generated ${formatDate(draft.createdAt)}`
    : 'Set the brief above, then generate a few directions to compare.'

  return (
    <div className="section">
      <SectionHeader title={draft ? draft.name : 'Studio'} subtitle={subtitle}>
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
            <Popover
              className="quality"
              align="end"
              width={260}
              ariaLabel="Set quality breakdown"
              label={<><strong className="num">{draft.qualityScore}</strong><span>fit</span></>}
            >
              <div className="popover-head">
                <span className="eyebrow">Heuristic fit</span>
                <small>not a rendered-audio score</small>
              </div>
              <div className="scores">
                <Score label="Energy" value={draft.energyFit} />
                <Score label="Harmony" value={draft.harmonicFlow} />
                <Score label="Tempo" value={draft.tempoFlow} />
                <Score label="Safety" value={draft.transitionSafety} />
                <Score label="Diversity" value={draft.diversity} />
              </div>
            </Popover>
            <button type="button" className="btn" disabled={!spotifyReady || busy} onClick={props.onPublish}>
              <Send size={14} /> Publish
            </button>
            <button type="button" className="btn primary" disabled={!props.tidalReady || busy} onClick={props.onPreviewTidal}>
              <Sparkles size={14} /> Preview in djay
            </button>
          </>
        )}
      </SectionHeader>

      <div className="section-body studio">
        <BriefBar
          value={request}
          tracks={tracks}
          crates={props.crates}
          eligibleCount={props.eligibleCount}
          busy={busy}
          onChange={props.onRequestChange}
          onGenerate={props.onGenerate}
          onNavigate={props.onNavigate}
        />

        <div className={`studio-main${draft ? '' : ' empty'}`}>
          <div className="studio-column">
            {pinned.length > 0 && (
              <div className="pinned-strip" aria-label="Must-play tracks">
                <span className="eyebrow">Must play</span>
                {pinned.map((track) => (
                  <span key={track.id} className="pinned-chip">
                    <Artwork track={track} size={22} />
                    <strong className="truncate">{track.title}</strong>
                    <button type="button" onClick={() => togglePin(track.id)} aria-label={`Unpin ${track.title}`}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}

            {!draft ? (
              <div className="panel empty">
                <Disc3 size={30} />
                <h2>No set yet</h2>
                <p>Set the length, arc, and crates above, pin anything that has to play, then generate variations to compare.</p>
                <button type="button" className="btn primary" onClick={props.onGenerate} disabled={busy}>
                  <Sparkles size={15} /> Generate set
                </button>
              </div>
            ) : (
              <>
                <WaveformDeck item={item} nextItem={nextItem} />
                <MixSheet
                  draft={draft}
                  selectedPosition={item?.position ?? 1}
                  pinnedIDs={request.requiredTrackIds}
                  feedback={feedback}
                  savingTransition={props.savingTransition}
                  onSelect={props.onSelectPosition}
                  onTogglePin={togglePin}
                  onFeedback={props.onFeedback}
                />
              </>
            )}
          </div>

          {draft && (
            <TrackInspector
              item={item}
              nextItem={nextItem}
              incomingFeedback={previousItem && item ? feedback.get(transitionKey(previousItem.track.id, item.track.id)) : undefined}
              outgoingFeedback={item && nextItem ? feedback.get(transitionKey(item.track.id, nextItem.track.id)) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="score">
      <span>{label}</span>
      <i><b style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i>
      <strong className="num">{Math.round(value)}</strong>
    </div>
  )
}
