/**
 * Extracts the video id from a YouTube URL (`watch?v=`, `youtu.be/` or `embed/`).
 * @param url the YouTube URL
 * @returns the 11 character video id, or `undefined` if the URL is not a YouTube video
 */
export function getYouTubeVideoId(url?: string): string | undefined {
  if (!url)
    return undefined
  const match = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/)
  return match?.[1]
}
