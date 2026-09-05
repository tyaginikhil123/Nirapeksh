import type { Channel } from '../data/channels'

/** Score overlap for “similar channels” — free, local, no paid model. */
export function findSimilarChannels(
  channel: Channel,
  all: Channel[],
  limit = 3,
): Channel[] {
  return all
    .filter((other) => other.id !== channel.id)
    .map((other) => {
      let score = 0
      if (other.focus === channel.focus) score += 4
      if (other.language === channel.language || other.language === 'Both' || channel.language === 'Both') {
        score += 2
      }
      const sharedTags = other.tags.filter((tag) => channel.tags.includes(tag))
      score += sharedTags.length * 3
      return { other, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.other.name.localeCompare(b.other.name))
    .slice(0, limit)
    .map((row) => row.other)
}
