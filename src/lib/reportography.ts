import feedList from '../../data/reportography-feeds.json'
import { significantQueryTokens } from './smartSearch'

export type ReportLanguage = 'Hindi' | 'English'

export type NewspaperArticle = {
  id: string
  title: string
  dek: string
  url: string
  source: string
  language: ReportLanguage
  publishedAt?: string
  kicker: string
}

export type NewspaperStory = {
  id: string
  headline: string
  dek: string
  kicker: string
  language: ReportLanguage | 'Both'
  publishedAt?: string
  reports: NewspaperArticle[]
  interest: number
}

export type NewspaperBrief = {
  stories: NewspaperStory[]
  reportCount: number
  sourceCount: number
  dayKey: string
  fetchedAt: string
}

export type NewspaperFeed = {
  source: string
  language: ReportLanguage
  url: string
}

export const NEWSPAPER_FEEDS: NewspaperFeed[] = feedList as NewspaperFeed[]

const TITLE_NOISE = new Set([
  'india',
  'indian',
  'news',
  'latest',
  'today',
  'live',
  'breaking',
  'explained',
  'opinion',
  'भारत',
  'इंडिया',
  'खबर',
  'समाचार',
  'ताजा',
])

const POWER_ALIASES: Record<string, string[]> = {
  ias: ['आईएएस', 'dm', 'डीएम', 'collector', 'कलेक्टर', 'sdm', 'bureaucrat', 'bureaucracy', 'अधिकारी'],
  scam: ['घोटाला', 'fraud', 'भ्रष्टाचार', 'corruption', 'bribe', 'रिश्वत'],
  leak: ['लीक', 'पेपर', 'paper', 'neet', 'recruitment', 'भर्ती'],
  farmer: ['किसान', 'kisan', 'andolan', 'आंदोलन'],
  land: ['जमीन', 'ज़मीन', 'demolition', 'बुलडोजर', 'bulldozer'],
  police: ['पुलिस', 'encounter', 'एनकाउंटर', 'custody', 'हिरासत'],
  court: ['कोर्ट', 'supreme', 'highcourt', 'judiciary', 'न्यायपालिका', 'rti', 'आरटीआई'],
  raid: ['छापा', 'ed', 'cbi'],
}

const POWER_TOKENS = new Set(
  Object.entries(POWER_ALIASES).flatMap(([key, aliases]) => [
    key,
    ...aliases.map((alias) => alias.toLowerCase()),
  ]),
)

export function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

export function stripHtml(html: string): string {
  return decodeXml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tagValue(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'),
  )
  if (cdata?.[1]) return decodeXml(cdata[1]).trim()
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return plain?.[1] ? decodeXml(plain[1]).trim() : ''
}

const THEATRE =
  /मॉक\s*संसद|mock\s*parliament|mamdani|ममदानी|zohran|it[’']?s done bro|nidhi razdan|नज़रबंदी|नजरबंदी|से मिले|से मुलाकात|met with|photo\s*op|podcast|studio chat|चैट/i

const CORRUPTION =
  /corrupt|भ्रष्टाचार|घोटाला|scam|fraud|bribe|रिश्वत|embezzl|hawala|benami|disproportionate|illegal wealth|घूस|kickback|किकबैक|fake bill|फर्जी/i

const EXPOSE =
  /leak|लीक|raid|छापा|expose|खुलासा|sting|ed\b|cbi\b|paper leak|भर्ती|neet|ugc|disproportionate assets|benami/i

const SHOCK =
  /stampede|भगदड़|train accident|रेल दुर्घटना|blast|धमाका|collapse|गिर गई|bridge|पुल गिरा|custodial death|हिरासत में मौत|adulterat|मिलावट|poison|जहर|fake medicine|नकली दवा|mass firing|गोलीबारी/i

const POWER_CRIME =
  /(ias|आईएएस|dm\b|collector|कलेक्टर|officer|अधिकारी|bureaucrat).{0,48}(arrest|caught|corrupt|scam|raid|assets|graft|गिरफ्तार|रंगे हाथ|घोटाला|भ्रष्ट)/i

function haystack(title: string, dek: string): string {
  return `${title} ${dek}`
}

const DAY_MS = 36 * 60 * 60 * 1000
const TWO_DAY_MS = 48 * 60 * 60 * 1000

export function istDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function publishedAtMs(article: NewspaperArticle): number | null {
  if (!article.publishedAt) return null
  const at = Date.parse(article.publishedAt)
  return Number.isFinite(at) ? at : null
}

function inWindow(article: NewspaperArticle, ms: number, now: number): boolean {
  const at = publishedAtMs(article)
  if (at == null) return true
  return now - at <= ms
}

function isPoliticalTheatre(title: string, dek: string): boolean {
  const hay = haystack(title, dek)
  if (THEATRE.test(hay)) return true
  if (
    /(fir|एफआईआर|हिरासत|remand|custody|नज़रबंदी)/i.test(hay) &&
    !CORRUPTION.test(hay) &&
    !EXPOSE.test(hay) &&
    !POWER_CRIME.test(hay) &&
    !/(death|मौत)/i.test(hay)
  ) {
    return true
  }
  if (
    /(दावा|claims?|\bsays\b|बोले|बोली|बोला)/i.test(hay) &&
    !CORRUPTION.test(hay) &&
    !EXPOSE.test(hay) &&
    !SHOCK.test(hay) &&
    !POWER_CRIME.test(hay)
  ) {
    return true
  }
  return false
}

export function isShockPublicInterest(title: string, dek: string): boolean {
  if (isPoliticalTheatre(title, dek)) return false
  const hay = haystack(title, dek)
  return CORRUPTION.test(hay) || EXPOSE.test(hay) || SHOCK.test(hay) || POWER_CRIME.test(hay)
}

export function articleKicker(title: string, dek: string): string {
  const hay = haystack(title, dek).toLowerCase()
  if (CORRUPTION.test(hay) || POWER_CRIME.test(hay)) return 'corruption'
  if (SHOCK.test(hay)) return 'breaking'
  if (/(ias|आईएएस|dm\b|डीएम|collector|कलेक्टर|bureaucrat)/i.test(hay)) return 'bureaucracy'
  if (/(court|कोर्ट|judiciary|rti|आरटीआई|supreme)/i.test(hay)) return 'courts'
  if (EXPOSE.test(hay) || /(raid|छापा|ed\b|cbi)/i.test(hay)) return 'investigation'
  if (/(farmer|किसान|land|जमीन|ground)/i.test(hay)) return 'ground'
  return 'public'
}

function storyTokens(title: string): Set<string> {
  const tokens = significantQueryTokens(title).filter(
    (token) => token.length >= 3 && !TITLE_NOISE.has(token),
  )
  const expanded = new Set(tokens)
  for (const token of tokens) {
    for (const [key, aliases] of Object.entries(POWER_ALIASES)) {
      const bucket = [key, ...aliases.map((alias) => alias.toLowerCase())]
      if (bucket.includes(token)) {
        for (const item of bucket) expanded.add(item)
      }
    }
  }
  return expanded
}

function interestScore(article: NewspaperArticle, tokens: Set<string>): number {
  let score = 1
  for (const token of tokens) {
    if (POWER_TOKENS.has(token)) score += 3
  }
  const published = article.publishedAt ? Date.parse(article.publishedAt) : Number.NaN
  if (Number.isFinite(published)) {
    const age = Date.now() - published
    if (age <= 36 * 60 * 60 * 1000) score += 2
    else if (age <= 7 * 24 * 60 * 60 * 1000) score += 1
  }
  return score
}

function overlap(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((token) => b.has(token))
}

export function clusterNewspaperReports(articles: NewspaperArticle[]): NewspaperStory[] {
  const unique: NewspaperArticle[] = []
  const seen = new Set<string>()
  for (const article of articles) {
    if (!isShockPublicInterest(article.title, article.dek)) continue
    const key = article.url || `${article.source}:${article.title}`
    if (seen.has(key) || seen.has(article.title.toLowerCase())) continue
    seen.add(key)
    seen.add(article.title.toLowerCase())
    unique.push(article)
  }

  const tokens = unique.map((article) => storyTokens(article.title))
  const parent = unique.map((_, index) => index)

  function find(index: number): number {
    if (parent[index] !== index) parent[index] = find(parent[index])
    return parent[index]
  }

  function union(left: number, right: number) {
    const a = find(left)
    const b = find(right)
    if (a !== b) parent[b] = a
  }

  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const shared = overlap(tokens[i], tokens[j])
      if (
        shared.length >= 2 ||
        (shared.length >= 1 && shared.some((token) => POWER_TOKENS.has(token) || token.length >= 6))
      ) {
        union(i, j)
      }
    }
  }

  const groups = new Map<number, number[]>()
  unique.forEach((_, index) => {
    const root = find(index)
    const list = groups.get(root) ?? []
    list.push(index)
    groups.set(root, list)
  })

  return [...groups.values()]
    .map((indexes) => {
      const reports = indexes
        .map((index) => unique[index])
        .sort((a, b) => {
          const aScore = interestScore(a, storyTokens(a.title))
          const bScore = interestScore(b, storyTokens(b.title))
          if (bScore !== aScore) return bScore - aScore
          return (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0)
        })
      const lead = reports[0]
      const languages = new Set(reports.map((item) => item.language))
      const interest =
        reports.reduce((sum, item) => sum + interestScore(item, storyTokens(item.title)), 0) +
        (reports.length > 1 ? 4 : 0)
      return {
        id: reports.map((item) => item.id).join('-'),
        headline: lead.title,
        dek: lead.dek,
        kicker: lead.kicker,
        language: languages.size > 1 ? 'Both' : lead.language,
        publishedAt: lead.publishedAt,
        reports,
        interest,
      } satisfies NewspaperStory
    })
    .sort((a, b) => {
      if (b.interest !== a.interest) return b.interest - a.interest
      return (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0)
    })
}

function rss2jsonItems(
  feed: NewspaperFeed,
  payload: {
    items?: Array<{
      title?: string
      description?: string
      content?: string
      link?: string
      url?: string
      pubDate?: string
    }>
  },
): NewspaperArticle[] {
  return (payload.items ?? []).flatMap((item, index) => {
    const title = stripHtml(item.title ?? '')
    const url = (item.link || item.url || '').trim()
    const dek = stripHtml(item.description || item.content || '').slice(0, 420)
    if (!title || !url || !isShockPublicInterest(title, dek)) return []
    return [
      {
        id: `${feed.source}-${index}-${url}`,
        title,
        dek,
        url,
        source: feed.source,
        language: feed.language,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        kicker: articleKicker(title, dek),
      },
    ]
  })
}

async function loadFromRssBridge(): Promise<NewspaperArticle[]> {
  const rows = await Promise.all(
    NEWSPAPER_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`,
        )
        if (!res.ok) return [] as NewspaperArticle[]
        const data = (await res.json()) as Parameters<typeof rss2jsonItems>[1]
        return rss2jsonItems(feed, data)
      } catch {
        return [] as NewspaperArticle[]
      }
    }),
  )
  return rows.flat()
}

export async function loadNewspaperBrief(): Promise<NewspaperBrief> {
  const dayKey = istDayKey()
  let articles: NewspaperArticle[] = []
  try {
    const res = await fetch(`/api/reportography?day=${encodeURIComponent(dayKey)}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = (await res.json()) as { articles?: NewspaperArticle[] }
      articles = data.articles ?? []
    }
  } catch {
    articles = []
  }
  if (articles.length === 0) {
    articles = await loadFromRssBridge()
  }

  const now = Date.now()
  const today = articles.filter((article) => inWindow(article, DAY_MS, now))
  const pool = today.length >= 3 ? today : articles.filter((article) => inWindow(article, TWO_DAY_MS, now))
  const stories = clusterNewspaperReports(pool.length ? pool : articles)
  const kept = stories.flatMap((story) => story.reports)
  return {
    stories,
    reportCount: kept.length,
    sourceCount: new Set(kept.map((item) => item.source)).size,
    dayKey,
    fetchedAt: new Date().toISOString(),
  }
}
