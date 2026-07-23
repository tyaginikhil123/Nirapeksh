export type TrustReview = {
  uid: string
  name: string
  text: string
  createdAt: string
}

export async function fetchReviews(
  channelId: string,
): Promise<TrustReview[]> {
  const res = await fetch(`/api/reviews?channelId=${encodeURIComponent(channelId)}`)
  if (!res.ok) return []
  const data = (await res.json()) as { reviews?: TrustReview[] }
  return data.reviews ?? []
}

export async function submitReview(
  channelId: string,
  text: string,
  idToken: string,
): Promise<TrustReview[]> {
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ channelId, text }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? 'Could not save review')
  }
  const data = (await res.json()) as { reviews: TrustReview[] }
  return data.reviews
}

export async function fetchChannelsApi() {
  const res = await fetch('/api/channels')
  if (!res.ok) throw new Error('Could not load channels')
  return (await res.json()) as { channels: unknown[] }
}

export async function saveChannelsApi(channels: unknown[], adminSecret: string) {
  const res = await fetch('/api/channels', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret,
    },
    body: JSON.stringify({ channels }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? 'Could not save channels')
  }
  return (await res.json()) as { channels: unknown[] }
}
