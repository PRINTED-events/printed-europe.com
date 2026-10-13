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

/**
 * Extracts the playlist id from a YouTube playlist URL, or accepts a bare id.
 * @param url the playlist URL or id
 * @returns the playlist id, or `undefined` if there is none
 */
export function getYouTubePlaylistId(url?: string): string | undefined {
  if (!url)
    return undefined
  const match = url.match(/[?&]list=([\w-]{10,64})/) ?? url.trim().match(/^([\w-]{10,64})$/)
  return match?.[1]
}

/**
 * Splits the title of a talk recording into talk title and speaker. Understands
 * the forms used on the PRINTED channel, `"Talk title" mit Speaker` and
 * `Talk title - with Speaker`, and falls back to the whole title.
 * @param videoTitle the title of the video on YouTube
 * @returns the talk title and, if it could be read, the speaker
 */
export function parseTalkVideoTitle(videoTitle: string): { title: string, speaker?: string } {
  const text = videoTitle.trim()
  const stripSeparator = (part: string) => part.trim().replace(/^[-–—|:]+|[-–—|:]+$/g, '').trim()

  // `"Talk title" mit Speaker`
  if ('"“„«'.includes(text.charAt(0))) {
    const end = [...text].findIndex((char, index) => index > 0 && '"”“»'.includes(char))
    if (end > 0) {
      const speaker = stripSeparator(text.slice(end + 1)).replace(/^(?:mit|with|von|by) /i, '').trim()
      return { title: text.slice(1, end).trim(), speaker: speaker || undefined }
    }
  }

  // `Talk title - with Speaker`: only a "mit" / "with" right after a dash
  // names the speaker, because the word is common inside talk titles as well.
  const parts = text.split(/ [-–—|] ?(?:mit|with) /i)
  if (parts.length > 1) {
    const speaker = parts.pop()!.trim()
    return { title: stripSeparator(parts.join(' – ')), speaker }
  }

  return { title: text }
}

/**
 * Reduces a title to lowercase letters and digits, so two spellings of the
 * same talk title compare as equal.
 * @param text the title
 * @returns the comparable form
 */
export function normalizeTalkTitle(text: string): string {
  return text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '')
}
