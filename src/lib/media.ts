import { useEffect, useState } from 'react'

/** Client media-query hook; defaults to `true` before mount to prefer desktop layout in SSR-ish first paint. */
export function useMediaQuery(query: string, defaultMatches = true): boolean {
  const [matches, setMatches] = useState(defaultMatches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
