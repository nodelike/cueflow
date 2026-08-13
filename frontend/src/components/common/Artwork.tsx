import { Disc3, ExternalLink } from 'lucide-react'
import type { Track } from '../../types'

type Props = { track: Track; size?: number; linked?: boolean }

/** Album art with a disc fallback. `linked` opens the recording on Spotify. */
export function Artwork({ track, size = 40, linked = false }: Props) {
  const style = { width: size, height: size }
  const image = track.albumImageUrl
    ? <img src={track.albumImageUrl} alt="" loading="lazy" />
    : <span className="artwork-fallback"><Disc3 size={Math.round(size * .42)} /></span>

  if (linked && track.spotifyId) {
    return (
      <a
        className="artwork linked"
        style={style}
        href={`https://open.spotify.com/track/${track.spotifyId}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${track.title} on Spotify`}
      >
        {image}
        <ExternalLink className="artwork-link-icon" size={13} />
      </a>
    )
  }
  return <span className="artwork" style={style} aria-hidden="true">{image}</span>
}
