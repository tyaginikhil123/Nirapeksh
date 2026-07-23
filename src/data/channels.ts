import seedChannels from '../../data/channels.json'

export type Language = 'Hindi' | 'English' | 'Both'
export type Focus =
  | 'Ground report'
  | 'Investigation'
  | 'Analysis'
  | 'Media watch'
  | 'Explainer'
  | 'Legal'
  | 'Satire'

export type SampleVideo = {
  id: string
  title: string
}

export type Channel = {
  id: string
  name: string
  handle: string
  channelId: string
  youtubeUrl: string
  founder: string
  blurb: string
  language: Language
  focus: Focus
  subscribersLabel: string
  tags: string[]
  sampleVideos: SampleVideo[]
}

export const FOCUS_OPTIONS: Focus[] = [
  'Ground report',
  'Investigation',
  'Analysis',
  'Media watch',
  'Explainer',
  'Legal',
  'Satire',
]

export const channels: Channel[] = seedChannels as Channel[]

export function allTags(list: Channel[] = channels): string[] {
  return [...new Set(list.flatMap((channel) => channel.tags))].sort((a, b) =>
    a.localeCompare(b),
  )
}
