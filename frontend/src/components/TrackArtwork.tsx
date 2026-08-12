import { Disc3, ExternalLink } from 'lucide-react'
import type { Track } from '../types'

type Props = { track: Track; linked?: boolean; className?: string }

export function TrackArtwork({ track, linked = false, className = '' }: Props) {
  const artwork = track.albumImageUrl
    ? <img src={track.albumImageUrl} alt="" loading="lazy" />
    : <span className="artwork-fallback"><Disc3 size={15} /></span>

  if (linked && track.spotifyId) {
    return <a className={`track-artwork linked ${className}`} href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} on Spotify`}>{artwork}<ExternalLink className="artwork-link-icon" size={9} /></a>
  }
  return <span className={`track-artwork ${className}`} aria-hidden="true">{artwork}</span>
}
