import { loadNewspaperReports } from '../server/reportography-feeds'

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => { json: (body: unknown) => void }
}

export default async function handler(
  req: { method?: string },
  res: ApiResponse,
) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const articles = await loadNewspaperReports()
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
  res.status(200).json({ articles })
}
