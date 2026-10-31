import feedList from '../data/reportography-feeds.json'

export type NewspaperArticle = {
  id: string
  title: string
  dek: string
  url: string
  source: string
  language: 'Hindi' | 'English'
  publishedAt?: string
  kicker: string
}

type NewspaperFeed = {
  source: string
  language: 'Hindi' | 'English'
  url: string
}

const FEEDS = feedList as NewspaperFeed[]

function decodeXml(text: string): string {
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

function stripHtml(html: string): string {
  return decodeXml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tagValue(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'),
  )
  if (cdata?.[1]) return decodeXml(cdata[1]).trim()
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return plain?.[1] ? decodeXml(plain[1]).trim() : ''
}

function articleKicker(title: string, dek: string): string {
  const hay = `${title} ${dek}`.toLowerCase()
  if (/(ias|आईएएस|dm\b|डीएम|collector|कलेक्टर|bureaucrat)/i.test(hay)) return 'bureaucracy'
  if (/(court|कोर्ट|judiciary|rti|आरटीआई|supreme)/i.test(hay)) return 'courts'
  if (/(scam|घोटाला|corrupt|भ्रष्टाचार|raid|छापा|ed\b|cbi)/i.test(hay)) return 'investigation'
  if (/(farmer|किसान|land|जमीन|ground)/i.test(hay)) return 'ground'
  return 'public'
}

function itemLink(block: string): string {
  const alt = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1]
  if (alt) return alt.trim()
  return tagValue(block, 'link') || tagValue(block, 'guid')
}

function itemDate(block: string): string | undefined {
  const raw =
    tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated')
  if (!raw) return undefined
  const at = new Date(raw)
  return Number.isFinite(at.getTime()) ? at.toISOString() : undefined
}

function parseFeed(xml: string, feed: NewspaperFeed): NewspaperArticle[] {
  const chunks = xml.includes('<item')
    ? xml.split(/<item[\s>]/i).slice(1)
    : xml.split(/<entry[\s>]/i).slice(1)

  const articles: NewspaperArticle[] = []
  for (const [index, chunk] of chunks.entries()) {
    const title = stripHtml(tagValue(chunk, 'title'))
    const url = itemLink(chunk)
    const dek = stripHtml(
      tagValue(chunk, 'description') ||
        tagValue(chunk, 'summary') ||
        tagValue(chunk, 'content') ||
        tagValue(chunk, 'content:encoded'),
    ).slice(0, 420)
    if (!title || !url.startsWith('http')) continue
    articles.push({
      id: `${feed.source}-${index}-${url}`,
      title,
      dek,
      url,
      source: feed.source,
      language: feed.language,
      publishedAt: itemDate(chunk),
      kicker: articleKicker(title, dek),
    })
    if (articles.length >= 24) break
  }
  return articles
}

async function fetchFeed(feed: NewspaperFeed): Promise<NewspaperArticle[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NirpekshReportography/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    })
    if (!res.ok) return []
    return parseFeed(await res.text(), feed)
  } catch (error) {
    console.warn(`Reportography feed failed: ${feed.source}`, error)
    return []
  } finally {
    clearTimeout(timer)
  }
}

export async function loadNewspaperReports(): Promise<NewspaperArticle[]> {
  const rows = await Promise.all(FEEDS.map((feed) => fetchFeed(feed)))
  return rows.flat()
}
