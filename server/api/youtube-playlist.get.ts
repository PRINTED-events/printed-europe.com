/**
 * Lists the videos of a public YouTube playlist, in playlist order.
 *
 * Works without an API key. The videos are read from the public playlist
 * page, which holds up to 100 of them. If that page cannot be read, YouTube's
 * playlist feed is used instead, which only contains 15 videos. The result is
 * cached, so a newly added video shows up on the website within a few minutes
 * without a new deployment.
 *
 * Usage: `/api/youtube-playlist?list=<playlist id>`
 */

interface PlaylistVideo {
  id: string
  title: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' }

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name] ?? '')
}

/**
 * Collects the videos from the data YouTube embeds in a playlist page.
 * @param node any part of the embedded data
 * @param videos accumulator for the videos found
 * @returns the accumulator
 */
function collectVideos(node: unknown, videos: PlaylistVideo[] = []): PlaylistVideo[] {
  if (Array.isArray(node)) {
    node.forEach(item => collectVideos(item, videos))
    return videos
  }
  if (node === null || typeof node !== 'object')
    return videos

  const record = node as Record<string, any>

  // current page format
  const lockup = record.lockupViewModel
  if (lockup?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO') {
    videos.push({ id: lockup.contentId, title: lockup.metadata?.lockupMetadataViewModel?.title?.content })
    return videos
  }

  // previous page format
  const renderer = record.playlistVideoRenderer
  if (renderer) {
    videos.push({ id: renderer.videoId, title: renderer.title?.runs?.[0]?.text ?? renderer.title?.simpleText })
    return videos
  }

  Object.values(record).forEach(value => collectVideos(value, videos))
  return videos
}

async function readPlaylistPage(list: string): Promise<PlaylistVideo[]> {
  const page = await $fetch<string>('https://www.youtube.com/playlist', {
    query: { list, hl: 'en' },
    responseType: 'text',
    timeout: 8000,
    headers: {
      'accept-language': 'en',
      // Without the consent cookie, visitors from the EU get a consent page instead.
      'cookie': 'SOCS=CAI; CONSENT=YES+1',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) '
        + 'Chrome/126.0 Safari/537.36',
    },
  })

  const marker = 'var ytInitialData = '
  const start = page.indexOf(marker)
  const end = start === -1 ? -1 : page.indexOf(';</script>', start)
  if (end === -1)
    return []

  return collectVideos(JSON.parse(page.slice(start + marker.length, end)))
}

async function readPlaylistFeed(list: string): Promise<PlaylistVideo[]> {
  const feed = await $fetch<string>('https://www.youtube.com/feeds/videos.xml', {
    query: { playlist_id: list },
    responseType: 'text',
    timeout: 8000,
  })

  return [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry = '']) => ({
    id: entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1] ?? '',
    title: decodeEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim(),
  }))
}

export default defineCachedEventHandler(async (event): Promise<PlaylistVideo[]> => {
  const list = String(getQuery(event).list ?? '')
  if (!/^[\w-]{10,64}$/.test(list))
    throw createError({ statusCode: 400, statusMessage: 'Invalid playlist id' })

  // The website must not break when YouTube is unreachable or the playlist is private.
  for (const read of [readPlaylistPage, readPlaylistFeed]) {
    const videos = (await read(list).catch(() => []))
      .filter(video => /^[\w-]{11}$/.test(video.id ?? '') && typeof video.title === 'string' && video.title)
    if (videos.length > 0)
      return videos
  }
  return []
}, {
  // Renamed whenever the shape or source of the result changes, so stale entries are not served.
  name: 'youtube-playlist-page',
  maxAge: 60 * 10,
  swr: true,
  getKey: event => String(getQuery(event).list ?? ''),
})
