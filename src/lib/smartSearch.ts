import type { Channel } from '../data/channels'
import { getCachedVideoTitles } from './youtube'

/** Free client-side search: bilingual aliases + weighted word scoring. No paid API. */

const TOPIC_ALIASES: Record<string, string[]> = {
  election: ['elections', 'चुनाव', 'vote', 'voting', 'मतदान', 'poll', 'polls'],
  चुनाव: ['election', 'elections', 'vote', 'voting', 'poll'],
  politics: ['political', 'राजनीति', 'party', 'पार्टी', 'parliament', 'संसद'],
  राजनीति: ['politics', 'political', 'party'],

  // Place name only — do NOT expand to protest/rally (false hits across the directory).
  'jantar mantar': ['जंतर मंतर'],
  'जंतर मंतर': ['jantar mantar'],
  delhi: ['दिल्ली', 'ncr', 'delhi-ncr'],
  दिल्ली: ['delhi', 'ncr'],
  up: ['uttar pradesh', 'उत्तर प्रदेश', 'hindi belt'],
  bihar: ['बिहार'],
  jharkhand: ['झारखंड', 'झारखण्ड'],
  झारखंड: ['jharkhand'],
  झारखण्ड: ['jharkhand'],

  'paper leak': ['पेपर लीक', 'exam leak', 'neet'],
  'पेपर लीक': ['paper leak', 'exam', 'neet'],
  courts: ['court', 'कोर्ट', 'judiciary', 'न्यायपालिका', 'supreme court', 'high court'],
  court: ['courts', 'कोर्ट', 'judiciary', 'न्यायपालिका'],
  कोर्ट: ['court', 'courts', 'judiciary'],
  judiciary: ['courts', 'court', 'कोर्ट', 'न्यायपालिका'],
  media: ['मीडिया', 'press', 'पत्रकारिता', 'journalism'],
  मीडिया: ['media', 'press', 'journalism'],
  investigation: ['जांच', 'expose', 'scam', 'घोटाला', 'probe'],
  जांच: ['investigation', 'probe', 'expose'],
  economy: ['अर्थव्यवस्था', 'budget', 'बजट', 'inflation', 'महंगाई', 'gdp'],
  budget: ['बजट', 'economy', 'finance'],
  satire: ['व्यंग्य', 'comedy', 'humour', 'humor'],
  explainer: ['explained', 'basics'],
  ground: ['ground report', 'street', 'ज़मीनी', 'vox pop'],
  analysis: ['विश्लेषण', 'breakdown'],
  legal: ['कानून', 'law'],
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s@.+/_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  const n = normalize(text)
  if (!n) return []
  return n.split(' ').filter((token) => token.length > 1)
}

/** Filler words that appear in almost every Hindi/English title — never match channels on these. */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'on',
  'in',
  'to',
  'for',
  'is',
  'are',
  'was',
  'were',
  'by',
  'with',
  'from',
  'at',
  'as',
  'it',
  'this',
  'that',
  'be',
  'ki',
  'ke',
  'ka',
  'ko',
  'se',
  'pe',
  'par',
  'mein',
  'me',
  'mai',
  'hai',
  'hain',
  'aur',
  'ya',
  'ye',
  'wo',
  'kya',
  'ek',
  'do',
  'bhi',
  'na',
  'nahi',
  'nahin',
  'की',
  'के',
  'का',
  'को',
  'से',
  'पे',
  'पर',
  'में',
  'है',
  'हैं',
  'और',
  'या',
  'यह',
  'वो',
  'क्या',
  'एक',
  'भी',
  'न',
  'नहीं',
])

const ALIAS_TOKENS = new Set(
  Object.keys(TOPIC_ALIASES).flatMap((key) => tokenize(key)),
)

function keepQueryToken(token: string): boolean {
  if (STOPWORDS.has(token)) return false
  if (token.length >= 3) return true
  return ALIAS_TOKENS.has(token)
}

/** Distinctive search words (stopwords like "ki" / "pe" dropped). */
export function significantQueryTokens(query: string): string[] {
  return tokenize(query).filter(keepQueryToken)
}

export function significantQueryTokenCount(query: string): number {
  return significantQueryTokens(query).length
}

function expandQuery(query: string): Set<string> {
  const tokens = significantQueryTokens(query)
  const expanded = new Set<string>(tokens)
  const joined = normalize(query)

  for (const [key, aliases] of Object.entries(TOPIC_ALIASES)) {
    const keyN = normalize(key)
    const keyParts = tokenize(keyN)
    const directHit =
      joined === keyN ||
      tokens.includes(keyN) ||
      (keyParts.length > 1 && keyParts.every((part) => tokens.includes(part))) ||
      tokens.some((t) => t === keyN)

    if (!directHit) continue

    expanded.add(keyN)
    for (const part of keyParts) expanded.add(part)
    for (const alias of aliases) {
      const a = normalize(alias)
      expanded.add(a)
      for (const part of tokenize(a)) expanded.add(part)
    }
  }

  return expanded
}

/** Whole-word / whole-phrase match only — avoids "law" inside "laundry". */
function fieldScore(haystack: string, terms: Set<string>, weight: number): number {
  if (!haystack || terms.size === 0) return 0
  const hay = normalize(haystack)
  if (!hay) return 0
  const words = new Set(tokenize(hay))

  let score = 0
  for (const term of terms) {
    if (term.length < 2) continue

    if (hay === term) {
      score += weight * 3
      continue
    }

    // Multi-word phrase (e.g. "jantar mantar", "supreme court")
    if (term.includes(' ')) {
      if (hay.includes(term)) score += weight * 2
      continue
    }

    if (words.has(term)) {
      score += weight * 2
      continue
    }

    // Place/topic tokens often sit inside longer compound titles — allow contains for 5+ chars
    if (term.length >= 5 && hay.includes(term)) {
      score += weight
      continue
    }

    // Prefix only for longer terms (e.g. court → courts), never short stubs
    if (term.length >= 5) {
      for (const word of words) {
        if (word.length >= 5 && (word.startsWith(term) || term.startsWith(word))) {
          score += weight
          break
        }
      }
    }
  }
  return score
}

export type ScoredChannel = {
  channel: Channel
  score: number
}

export type SearchVideoIndex = Record<string, string[]>

function videoHaystack(channel: Channel, videoIndex?: SearchVideoIndex): string {
  const sample = channel.sampleVideos.map((video) => video.title)
  const live =
    videoIndex?.[channel.id] ?? getCachedVideoTitles(channel.channelId)
  return [...sample, ...live].join(' ')
}

export function scoreChannel(
  channel: Channel,
  query: string,
  videoIndex?: SearchVideoIndex,
): number {
  const q = query.trim()
  if (!q) return 1

  const terms = expandQuery(q)
  const videoText = videoHaystack(channel, videoIndex)
  // Latest titles are noisy; ignore stubs so Hindi filler in titles cannot rank a channel.
  const videoTerms = new Set(
    [...terms].filter((term) => term.includes(' ') || term.length >= 4),
  )

  return (
    fieldScore(channel.name, terms, 10) +
    fieldScore(channel.handle, terms, 8) +
    fieldScore(channel.founder, terms, 5) +
    fieldScore(channel.focus, terms, 6) +
    fieldScore(channel.tags.join(' '), terms, 7) +
    fieldScore(channel.blurb, terms, 4) +
    fieldScore(videoText, videoTerms, 8) +
    fieldScore(channel.language, terms, 2)
  )
}

/** Rank channels for a free-text query. Empty query → score 1 for all. */
export function smartSearchChannels(
  channels: Channel[],
  query: string,
  videoIndex?: SearchVideoIndex,
): ScoredChannel[] {
  const q = query.trim()
  if (!q) {
    return channels.map((channel) => ({ channel, score: 1 }))
  }

  return channels
    .map((channel) => ({
      channel,
      score: scoreChannel(channel, q, videoIndex),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.channel.name.localeCompare(b.channel.name))
}
