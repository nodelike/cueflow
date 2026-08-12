import type { Bootstrap, SetDraft } from '../types'

export const draft: SetDraft = {
  id: 'draft-a', sessionId: 'session-1', name: 'Afro to pressure — A', variation: 1, arc: 'journey',
  durationSeconds: 3590, qualityScore: 88.4, energyFit: 91, harmonicFlow: 86,
  tempoFlow: 92, diversity: 83, createdAt: '2026-08-12T18:00:00Z',
  tracks: [
    {
      position: 1, targetEnergy: .3, transition: { fromTrackId: '', toTrackId: '', score: 0, risk: '', summary: '', components: [] },
      track: { id: 'one', title: 'Salt Horizon', artist: 'Mara Vale', durationSeconds: 300, bpm: 116, musicalKey: 'A minor', camelot: '8A', energy: .28, groove: 'afro', vocal: .12, role: 'opener', sourcePlaylist: 'Afro Vibezz', addedAt: '2026-08-07T10:00:00Z', featureConfidence: .92, featureProvenance: 'fixture', featureNeedsReview: false },
    },
    {
      position: 2, targetEnergy: .4,
      transition: { fromTrackId: 'one', toTrackId: 'two', score: .9, risk: 'low', summary: 'tempo locks cleanly; harmonic movement is smooth', components: [{ name: 'tempo', score: .95, note: '+1 BPM movement' }, { name: 'harmony', score: .96, note: 'adjacent Camelot movement' }] },
      track: { id: 'two', title: 'Clay Drums', artist: 'Nilo & Sefa', durationSeconds: 312, bpm: 117, musicalKey: 'E minor', camelot: '9A', energy: .34, groove: 'afro', vocal: .05, role: 'builder', sourcePlaylist: 'Afro Vibezz', addedAt: '2026-08-07T13:00:00Z', featureConfidence: .92, featureProvenance: 'fixture', featureNeedsReview: false },
    },
  ],
}

export const bootstrapData: Bootstrap = { databaseReady: true, trackCount: 40, draftCount: 1, tracks: draft.tracks.map((item) => item.track), drafts: [draft] }
