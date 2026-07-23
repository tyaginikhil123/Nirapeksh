export type RatingState = {
  sum: number
  count: number
  average: number
  userRating: number | null
}

export type SampleVideo = {
  id: string
  title: string
  thumbnail: string
  url: string
}

export type ChannelMeta = {
  avatar: string | null
  videos: SampleVideo[]
}

export function getAverage(state: RatingState): number {
  return state.average
}

export async function fetchAllRatings(
  channelIds: string[],
  idToken?: string | null,
): Promise<Record<string, RatingState>> {
  const empty = Object.fromEntries(
    channelIds.map((id) => [
      id,
      {
        sum: 0,
        count: 0,
        average: 0,
        userRating: null,
      } satisfies RatingState,
    ]),
  ) as Record<string, RatingState>

  try {
    const res = await fetch('/api/ratings', {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    })
    if (!res.ok) return empty
    const data = (await res.json()) as {
      channels: Record<string, { sum: number; count: number; average: number }>
      mine?: Record<string, number>
    }

    const next = { ...empty }
    for (const id of channelIds) {
      const remote = data.channels?.[id]
      next[id] = {
        sum: remote?.sum ?? 0,
        count: remote?.count ?? 0,
        average: remote?.average ?? 0,
        userRating: data.mine?.[id] ?? null,
      }
    }
    return next
  } catch {
    return empty
  }
}

export async function submitAuthenticatedRating(
  channelId: string,
  rating: number,
  idToken: string,
): Promise<RatingState> {
  const res = await fetch('/api/ratings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      channelId,
      rating,
    }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? 'Could not save rating')
  }

  const data = (await res.json()) as {
    sum: number
    count: number
    average: number
    userRating: number
  }

  return {
    sum: data.sum,
    count: data.count,
    average: data.average,
    userRating: data.userRating,
  }
}

export async function fetchChannelMeta(
  channelId: string,
  handle: string,
): Promise<ChannelMeta> {
  const params = new URLSearchParams({ handle })
  const res = await fetch(`/api/youtube/${encodeURIComponent(channelId)}/meta?${params}`)
  if (!res.ok) {
    return {
      avatar: `https://unavatar.io/youtube/${handle.replace(/^@/, '')}`,
      videos: [],
    }
  }
  return (await res.json()) as ChannelMeta
}
