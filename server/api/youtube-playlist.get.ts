/**
 * Lists the videos of a public YouTube playlist, newest first.
 *
 * Reads YouTube's public playlist feed, which needs no API key but only
 * contains the 15 most recent videos of a playlist. The result is cached, so
 * a newly published video shows up on the website within a few minutes
 * without a new deployment.
 *
 * Usage: `/api/youtube-playlist?list=<playlist id>`
 */

interface PlaylistVideo {
  id: string
  title: string
  published: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' }

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name] ?? '')
}

export default defineCachedEventHandler(async (event): Promise<PlaylistVideo[]> => {
  const list = String(getQuery(event).list ?? '')
  if (!/^[\w-]{10,64}$/.test(list))
    throw createError({ statusCode: 400, statusMessage: 'Invalid playlist id' })

  let feed: string
  try {
    feed = await $fetch<string>('https://www.youtube.com/feeds/videos.xml', {
      query: { playlist_id: list },
      responseType: 'text',
      timeout: 8000,
    })
  }
  catch {
    // The website must not break when YouTube is unreachable or the playlist is private.
    return []
  }

  return [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map(([, entry = '']) => ({
      id: entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1] ?? '',
      title: decodeEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim(),
      published: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? '',
    }))
    .filter(video => video.id && video.title)
}, {
  maxAge: 60 * 10,
  swr: true,
  getKey: event => String(getQuery(event).list ?? ''),
})
