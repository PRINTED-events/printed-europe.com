<script setup lang="ts">
import { DateTime } from 'luxon'

definePageMeta({ layout: false })

// Screen/embed pages are for on-site use, not for visitors: keep them out
// of search results. They are excluded from the sitemap in `nuxt.config.ts`.
useRobotsRule('noindex, nofollow')

// Force dark mode globally
const colorMode = useColorMode()
onMounted(() => {
  colorMode.value = 'dark'
})

const appConfig = useAppConfig()
const timeZone = appConfig.general?.timeZone || 'UTC'
const logoPath = (appConfig.general as any)?.logo?.dark || '/printed-pd-02.png'

// ── Data ─────────────────────────────────────────────────────
const { data: stages, refresh: refreshStages } = await useAsyncData(
  'screen2-stages',
  () => queryCollection('stages').all(),
)
const { data: speakers, refresh: refreshSpeakers } = await useAsyncData(
  'screen2-speakers',
  () => queryCollection('speakers').all(),
)
const { data: rawTalks, refresh: refreshTalks } = await useAsyncData(
  'screen2-talks',
  () => queryCollection('talks').order('dateTime', 'ASC').all(),
)

// Auto-refresh data every 60 seconds
let refreshTimer: ReturnType<typeof setInterval>
onMounted(() => {
  refreshTimer = setInterval(() => {
    refreshTalks()
    refreshSpeakers()
    refreshStages()
  }, 60_000)
})
onUnmounted(() => clearInterval(refreshTimer))

// The content database is baked into the deployment and cached in the
// browser, so re-querying it can never show an edited schedule. Poll the
// deployed schedule's fingerprint instead and reload once it changes.
let versionTimer: ReturnType<typeof setInterval>
let knownVersion: string | null = null

async function checkScheduleVersion() {
  try {
    const res = await fetch(`/schedule/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok)
      return
    const { hash } = await res.json()
    if (!hash)
      return
    if (knownVersion === null) {
      knownVersion = hash
      return
    }
    if (hash !== knownVersion)
      window.location.reload()
  }
  catch {
    // offline or deploy in flight — try again on the next tick
  }
}

onMounted(() => {
  checkScheduleVersion()
  versionTimer = setInterval(checkScheduleVersion, 30_000)
})
onUnmounted(() => clearInterval(versionTimer))

// ── Process talks ────────────────────────────────────────────
const processedTalks = computed(() => {
  if (!rawTalks.value || !stages.value || !speakers.value)
    return []
  return rawTalks.value.map((talk) => {
    const speakerObjects = speakers.value!.filter(s => talk.speakers?.includes(s.slug))
    const stageObject = stages.value!.find(s => s.slug === talk.stage)
    const start = DateTime.fromISO(String(talk.dateTime), { zone: 'utc' }).setZone(timeZone)
    const end = start.plus({ minutes: talk.duration ?? 30 })
    return { ...talk, speakerObjects, stageObject, start, end }
  })
})

// Main Stage always first, remaining stages keep their natural (stable) order
const orderedStages = computed(() => {
  if (!stages.value)
    return []
  const main = stages.value.filter(s => s.slug === 'main-stage')
  const rest = stages.value.filter(s => s.slug !== 'main-stage')
  return [...main, ...rest]
})

// ── Date selection ───────────────────────────────────────────
const autoMode = ref(true)
const manualDate = ref('')

// ── Live clock / time simulation (same pattern as screen1) ────
const timeOverride = ref('')
const timeOverrideOffset = ref(0)

const nowTick = ref(DateTime.now().setZone(timeZone))
let clockTimer: ReturnType<typeof setInterval>
onMounted(() => {
  clockTimer = setInterval(() => {
    nowTick.value = DateTime.now().setZone(timeZone)
  }, 1000)
})
onUnmounted(() => clearInterval(clockTimer))

const now = computed(() => nowTick.value.plus(timeOverrideOffset.value))
const clockDisplay = computed(() => now.value.toFormat('HH:mm'))
const isTimeOverride = computed(() => !!timeOverride.value)

function applyTimeOverride(hhmm: string) {
  if (!hhmm) {
    timeOverrideOffset.value = 0
    timeOverride.value = ''
    return
  }
  const [h, m] = hhmm.split(':').map(Number)
  const dateStr = manualDate.value || nowTick.value.toISODate()!
  const simTarget = DateTime.fromISO(dateStr, { zone: timeZone }).set({ hour: h, minute: m, second: 0, millisecond: 0 })
  timeOverrideOffset.value = simTarget.diff(nowTick.value).milliseconds
  timeOverride.value = hhmm
}

watch(manualDate, () => {
  if (timeOverride.value)
    applyTimeOverride(timeOverride.value)
})

const availableDays = computed(() => {
  const days = new Set<string>()
  processedTalks.value.forEach((t) => {
    const day = t.start.toISODate()
    if (day)
      days.add(day)
  })
  return Array.from(days).sort()
})

const selectedDay = computed(() => {
  if (autoMode.value) {
    const today = now.value.toISODate() ?? ''
    return availableDays.value.includes(today) ? today : (availableDays.value[0] ?? today)
  }
  return manualDate.value || availableDays.value[0] || ''
})

const dayTalks = computed(() => processedTalks.value.filter(t => t.start.toISODate() === selectedDay.value))

// ── View & stage selection ───────────────────────────────────
type ViewMode = 'timeline' | 'stagelist'
const viewMode = ref<ViewMode>('timeline')

const visibleStageSlugs = ref<Set<string>>(new Set((stages.value ?? []).map(s => s.slug)))
const singleStageSlug = ref('main-stage')

function toggleVisibleStage(slug: string) {
  if (visibleStageSlugs.value.has(slug)) {
    if (visibleStageSlugs.value.size > 1)
      visibleStageSlugs.value.delete(slug)
  }
  else {
    visibleStageSlugs.value.add(slug)
  }
  // Force reactivity on the Set and persist
  visibleStageSlugs.value = new Set(visibleStageSlugs.value)
  saveSettings()
}

const timelineStages = computed(() => orderedStages.value.filter(s => visibleStageSlugs.value.has(s.slug)))

const effectiveSingleStageSlug = computed(() => {
  if (orderedStages.value.some(s => s.slug === singleStageSlug.value))
    return singleStageSlug.value
  if (orderedStages.value.some(s => s.slug === 'main-stage'))
    return 'main-stage'
  return orderedStages.value[0]?.slug ?? 'main-stage'
})

const singleStageName = computed(() =>
  orderedStages.value.find(s => s.slug === effectiveSingleStageSlug.value)?.name ?? effectiveSingleStageSlug.value,
)

function validateStageSelection() {
  const validSlugs = new Set(orderedStages.value.map(s => s.slug))
  if (validSlugs.size === 0)
    return
  const filtered = new Set([...visibleStageSlugs.value].filter(s => validSlugs.has(s)))
  visibleStageSlugs.value = filtered.size > 0 ? filtered : new Set(validSlugs)
}

// ── Font scale ────────────────────────────────────────────────
const fontScale = ref(1.0)

// ── Sponsors ─────────────────────────────────────────────────
// Deliberately a single static image (no dynamic logo list, no scroll
// animation) — the column just centers whatever image is configured.
const showSponsors = ref(false)
const sponsorImageUrl = ref('/sponsors.png')
const sponsorImageError = ref(false)
// naturalWidth / naturalHeight of the currently loaded sponsor image, once
// known. Null until the <img> fires @load (or there is no image), in which
// case the column falls back to a fixed default width below.
const sponsorImageRatio = ref<number | null>(null)

watch(sponsorImageUrl, () => {
  sponsorImageError.value = false
  sponsorImageRatio.value = null
})

function onSponsorImageLoad(event: Event) {
  const img = event.target as HTMLImageElement
  sponsorImageRatio.value = img.naturalWidth > 0 && img.naturalHeight > 0
    ? img.naturalWidth / img.naturalHeight
    : null
}

// ── Sponsor column width (fills the column's full height, never distorted) ──
// The column's width is derived, not fixed: given the column's available
// height and the loaded image's aspect ratio, we compute the width that lets
// the image use 100% of that height (spaltenBreite = verfügbareHöhe *
// seitenverhältnis). The CSS content-box `width` set below is exactly that
// value; the column's existing horizontal padding is added on top of it by
// the box model itself, so the rendered total already includes it. Clamped
// to 12%–40% of the screen width — a very wide (landscape) image hits the
// max and then simply falls back to being letterboxed by `object-fit:
// contain` inside that fixed-width box, same as before this feature existed.
const SPONSOR_COL_MIN_FRAC = 0.12
const SPONSOR_COL_MAX_FRAC = 0.40
// Default/fallback fraction used before the image's ratio is known (or it's
// missing) — matches the column's previous fixed width so there is no jump
// while waiting for the image to load.
const SPONSOR_COL_FALLBACK_FRAC = 0.21

const sponsorColRef = ref<HTMLElement | null>(null)
// Measures the padding-free inner wrapper, i.e. the height actually
// available to the image — independent of the column's own (computed)
// width, since the column is a flex item whose height is stretched by its
// parent row regardless of its width.
const sponsorImgWrapRef = ref<HTMLElement | null>(null)
const sponsorImgAvailableHeight = ref(0)
let sponsorImgResizeObserver: ResizeObserver | null = null

watch(sponsorImgWrapRef, (el) => {
  sponsorImgResizeObserver?.disconnect()
  sponsorImgResizeObserver = null
  if (!el)
    return
  sponsorImgAvailableHeight.value = el.clientHeight
  sponsorImgResizeObserver = new ResizeObserver((entries) => {
    const h = entries[0]?.contentRect.height
    if (h && Math.abs(h - sponsorImgAvailableHeight.value) > 1)
      sponsorImgAvailableHeight.value = h
  })
  sponsorImgResizeObserver.observe(el)
})
onUnmounted(() => sponsorImgResizeObserver?.disconnect())

// Measures the screen body (virtual/pre-scale px — see the --font-scale
// comment near STAGE_HEADER_H above) so the 12%/40% clamp is a fraction of
// the actual window width regardless of font-scale.
const screenBodyRef = ref<HTMLElement | null>(null)
const screenBodyWidth = ref(0)
let screenBodyResizeObserver: ResizeObserver | null = null

watch(screenBodyRef, (el) => {
  screenBodyResizeObserver?.disconnect()
  screenBodyResizeObserver = null
  if (!el)
    return
  screenBodyWidth.value = el.clientWidth
  screenBodyResizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width
    if (w && Math.abs(w - screenBodyWidth.value) > 1)
      screenBodyWidth.value = w
  })
  screenBodyResizeObserver.observe(el)
})
onUnmounted(() => screenBodyResizeObserver?.disconnect())

const sponsorColWidthPx = computed<number | null>(() => {
  if (!screenBodyWidth.value)
    return null
  const minW = screenBodyWidth.value * SPONSOR_COL_MIN_FRAC
  const maxW = screenBodyWidth.value * SPONSOR_COL_MAX_FRAC
  if (!sponsorImageRatio.value || !sponsorImgAvailableHeight.value) {
    const fallback = screenBodyWidth.value * SPONSOR_COL_FALLBACK_FRAC
    return Math.min(maxW, Math.max(minW, fallback))
  }
  const desired = sponsorImgAvailableHeight.value * sponsorImageRatio.value
  return Math.min(maxW, Math.max(minW, desired))
})

// Resize an uploaded image client-side (max 1000px on the longer edge)
// before it ever touches localStorage — a raw phone photo easily blows
// past the ~5MB quota and throws QuotaExceededError on save.
function resizeImageFile(file: File, maxDim = 1920, jpegQuality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let width = img.naturalWidth
      let height = img.naturalHeight
      if (width <= 0 || height <= 0) {
        reject(new Error('Invalid image dimensions'))
        return
      }
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        }
        else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
      resolve(keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', jpegQuality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}

// Short-lived notice shown in the config overlay when an upload can't be
// stored (e.g. localStorage quota exceeded).
const uploadNotice = ref('')
let uploadNoticeTimer: ReturnType<typeof setTimeout>

function showUploadNotice(message: string) {
  uploadNotice.value = message
  clearTimeout(uploadNoticeTimer)
  uploadNoticeTimer = setTimeout(() => {
    uploadNotice.value = ''
  }, 4000)
}

async function onSponsorImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return

  let dataUrl: string
  try {
    dataUrl = await resizeImageFile(file)
  }
  catch {
    showUploadNotice('Image too large to store')
    return
  }

  const previous = sponsorImageUrl.value
  sponsorImageUrl.value = dataUrl
  if (!saveSettings()) {
    sponsorImageUrl.value = previous
    showUploadNotice('Image too large to store')
  }
}

// ── Format helpers ────────────────────────────────────────────
function fmtTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtCountdownHM(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0)
    return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

function fmtTime(dt: DateTime): string {
  return dt.toFormat('HH:mm')
}

function fmtDayLabel(iso: string): string {
  if (!iso)
    return ''
  return DateTime.fromISO(iso).setLocale('en').toFormat('EEE, d. MMM')
}

function fmtDayLabelLong(iso: string): string {
  if (!iso)
    return ''
  return DateTime.fromISO(iso).setLocale('en').toFormat('EEEE, d MMMM')
}

function speakerNames(talk: any): string {
  return (talk.speakerObjects ?? []).map((s: any) => s.name).join(', ')
}

function talkStatus(talk: any): 'live' | 'past' | 'future' {
  if (talk.start <= now.value && talk.end > now.value)
    return 'live'
  if (talk.end <= now.value)
    return 'past'
  return 'future'
}

function elapsedSecondsFor(talk: any): number {
  return Math.max(0, Math.floor(now.value.diff(talk.start, 'seconds').seconds))
}

function remainingSecondsFor(talk: any): number {
  return Math.max(0, Math.floor(talk.end.diff(now.value, 'seconds').seconds))
}

function progressFor(talk: any): number {
  const total = (talk.duration ?? 30) * 60
  return Math.min(100, Math.round((elapsedSecondsFor(talk) / total) * 100))
}

// ── Timeline geometry ───────────────────────────────────────────
// Layout runs in the same "virtual" pixel space as the --font-scale
// transform (see .screen-root): the whole root is scaled uniformly, so
// px measured on descendants (via clientHeight/ResizeObserver) already
// scale consistently with text size — thresholds below need no extra
// fontScale correction because both text and geometry share one space.
const STAGE_HEADER_H = 40
const CARD_GAP = 3
// Reserved breathing room at the very top and bottom of each day's grid so
// the first/last card never touches — let alone is covered by — the column
// header or the scroll edge.
const EDGE_PAD = 8
// The floor a card's box height can never go below. Sized generously so the
// single-line "compact" tier (padding + one line of text, which never wraps
// — it's nowrap+ellipsis) always has room, no matter how short the talk's
// duration is. This is what previously let a 10-minute talk collapse to an
// unreadable sliver.
const MIN_CARD_H = 34
// Heuristic starting guesses only — used for the very first paint to avoid
// a visible flash while the real (correct) tier is derived. The actual tier
// shown is always corrected after render by measuring the rendered content
// against the box (see cardTierOverride/measureCard below), so an imprecise
// guess here can never cause clipped text — it only affects how many cards
// need a downgrade pass.
const CARD_TIER_GUESS_FULL = 150
const CARD_TIER_GUESS_MEDIUM = 95
const CARD_TIER_GUESS_BRIEF = 55

const zoomMode = ref<'fit' | 'manual'>('fit')
const manualHourH = ref(150)

const timelineScrollRef = ref<HTMLElement | null>(null)
const timelineAvailableHeight = ref(0)
let timelineResizeObserver: ResizeObserver | null = null

watch(timelineScrollRef, (el) => {
  timelineResizeObserver?.disconnect()
  timelineResizeObserver = null
  if (!el)
    return
  timelineAvailableHeight.value = el.clientHeight
  timelineResizeObserver = new ResizeObserver((entries) => {
    const h = entries[0]?.contentRect.height
    if (h && Math.abs(h - timelineAvailableHeight.value) > 1)
      timelineAvailableHeight.value = h
  })
  timelineResizeObserver.observe(el)
})
onUnmounted(() => timelineResizeObserver?.disconnect())

const dayBounds = computed(() => {
  if (!dayTalks.value.length)
    return null
  let minStart = dayTalks.value[0]!.start
  let maxEnd = dayTalks.value[0]!.end
  for (const t of dayTalks.value) {
    if (t.start < minStart)
      minStart = t.start
    if (t.end > maxEnd)
      maxEnd = t.end
  }
  const startFloor = minStart.set({ minute: minStart.minute < 30 ? 0 : 30, second: 0, millisecond: 0 })
  let endCeil = maxEnd.set({ second: 0, millisecond: 0 })
  if (endCeil.minute === 0) {
    // already on the hour
  }
  else if (endCeil.minute <= 30) {
    endCeil = endCeil.set({ minute: 30 })
  }
  else {
    endCeil = endCeil.plus({ hours: 1 }).set({ minute: 0 })
  }
  if (endCeil <= startFloor)
    endCeil = startFloor.plus({ hours: 1 })
  return { start: startFloor, end: endCeil }
})

const dayTotalHours = computed(() => {
  if (!dayBounds.value)
    return 10
  return Math.max(0.5, dayBounds.value.end.diff(dayBounds.value.start, 'hours').hours)
})

const pxPerHour = computed(() => {
  if (zoomMode.value === 'manual')
    return manualHourH.value
  if (!timelineAvailableHeight.value || !dayTotalHours.value)
    return 100
  const usable = Math.max(60, timelineAvailableHeight.value - STAGE_HEADER_H - EDGE_PAD * 2)
  return Math.max(20, usable / dayTotalHours.value)
})

// Body height (axis + stage columns) including the top/bottom edge reserve.
const bodyHeightPx = computed(() => dayTotalHours.value * pxPerHour.value + EDGE_PAD * 2)

const timelineHourMarks = computed(() => {
  if (!dayBounds.value)
    return []
  const marks: DateTime[] = []
  let cursor = dayBounds.value.start
  while (cursor <= dayBounds.value.end) {
    marks.push(cursor)
    cursor = cursor.plus({ hours: 1 })
  }
  return marks
})

function markTop(m: DateTime): number {
  if (!dayBounds.value)
    return 0
  return EDGE_PAD + (m.diff(dayBounds.value.start, 'minutes').minutes / 60) * pxPerHour.value
}

// True only when "now" falls within the actual programme span (first
// talk start .. last talk end) of the selected day — not just the
// rounded view bounds.
const nowLineTopBody = computed<number | null>(() => {
  if (!dayBounds.value)
    return null
  if (selectedDay.value !== now.value.toISODate())
    return null
  if (!dayTalks.value.length)
    return null
  let progStart = dayTalks.value[0]!.start
  let progEnd = dayTalks.value[0]!.end
  for (const t of dayTalks.value) {
    if (t.start < progStart)
      progStart = t.start
    if (t.end > progEnd)
      progEnd = t.end
  }
  if (now.value < progStart || now.value > progEnd)
    return null
  return EDGE_PAD + (now.value.diff(dayBounds.value.start, 'minutes').minutes / 60) * pxPerHour.value
})

// ── Overlap-aware column layout ─────────────────────────────────
interface LaidOutTalk { talk: any, col: number, cols: number }

function layoutColumns(talks: any[]): LaidOutTalk[] {
  const sorted = [...talks].sort((a, b) =>
    a.start.toMillis() - b.start.toMillis() || a.end.toMillis() - b.end.toMillis())
  const result: LaidOutTalk[] = []
  let clusterItems: any[] = []
  let clusterEnd = -Infinity

  function flushCluster() {
    if (!clusterItems.length)
      return
    const colEnds: number[] = []
    const assigned: { talk: any, col: number }[] = []
    for (const t of clusterItems) {
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c]! <= t.start.toMillis()) {
          colEnds[c] = t.end.toMillis()
          assigned.push({ talk: t, col: c })
          placed = true
          break
        }
      }
      if (!placed) {
        colEnds.push(t.end.toMillis())
        assigned.push({ talk: t, col: colEnds.length - 1 })
      }
    }
    const cols = colEnds.length
    for (const a of assigned) result.push({ talk: a.talk, col: a.col, cols })
    clusterItems = []
  }

  for (const t of sorted) {
    if (clusterItems.length && t.start.toMillis() >= clusterEnd) {
      flushCluster()
      clusterEnd = -Infinity
    }
    clusterItems.push(t)
    if (t.end.toMillis() > clusterEnd)
      clusterEnd = t.end.toMillis()
  }
  flushCluster()
  return result
}

type CardTier = 'full' | 'medium' | 'brief' | 'compact'
interface TimelineCard { talk: any, tier: CardTier, style: Record<string, string> }

// The order tiers are tried in, richest first. A talk without speakers has
// no visual difference between 'medium' and 'brief' (the speaker line is
// already conditional on speakers existing), so its order skips 'brief' to
// avoid a pointless extra measure/downgrade pass.
function tierOrderFor(talk: any): CardTier[] {
  return (talk.speakerObjects?.length ?? 0) > 0
    ? ['full', 'medium', 'brief', 'compact']
    : ['full', 'medium', 'compact']
}

function guessTier(height: number): CardTier {
  if (height >= CARD_TIER_GUESS_FULL)
    return 'full'
  if (height >= CARD_TIER_GUESS_MEDIUM)
    return 'medium'
  if (height >= CARD_TIER_GUESS_BRIEF)
    return 'brief'
  return 'compact'
}

const timelineCardsByStage = computed(() => {
  const map = new Map<string, TimelineCard[]>()
  if (!dayBounds.value)
    return map
  for (const stage of timelineStages.value) {
    const stageTalks = dayTalks.value.filter(t => t.stageObject?.slug === stage.slug)
    const laidOut = layoutColumns(stageTalks)
    const cards: TimelineCard[] = laidOut.map((item) => {
      const startMin = item.talk.start.diff(dayBounds.value!.start, 'minutes').minutes
      const rawHeight = (item.talk.end.diff(item.talk.start, 'minutes').minutes / 60) * pxPerHour.value
      const top = EDGE_PAD + (startMin / 60) * pxPerHour.value
      const height = Math.max(rawHeight - CARD_GAP, MIN_CARD_H)
      const colWidthPct = 100 / item.cols
      return {
        talk: item.talk,
        tier: guessTier(height),
        style: {
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${colWidthPct * item.col}% + ${item.cols > 1 ? 2 : 0}px)`,
          width: `calc(${colWidthPct}% - ${item.cols > 1 ? 4 : 0}px)`,
        },
      }
    })
    map.set(stage.slug, cards)
  }
  return map
})

function stageCards(slug: string): TimelineCard[] {
  return timelineCardsByStage.value.get(slug) ?? []
}

const cardBySlug = computed(() => {
  const m = new Map<string, TimelineCard>()
  timelineCardsByStage.value.forEach(list => list.forEach(c => m.set(c.talk.slug, c)))
  return m
})

// ── Card tier correction (guarantees no clipped text, ever) ────────────
// The tier assigned above is only a best-effort guess based on box height.
// Real text height depends on actual wrapping (title length, column width,
// font metrics) which we don't want to re-implement in JS. Instead: render
// the guessed tier, then measure the real DOM box after paint — if its
// content overflows the fixed-height card, drop to the next lower tier and
// measure again. This directly enforces "never clipped", independent of
// fontScale, title length, or column width, rather than a hardcoded value.
const cardTierOverride = reactive<Record<string, CardTier>>({})

function effectiveTier(card: TimelineCard): CardTier {
  return cardTierOverride[card.talk.slug] ?? card.tier
}

const cardEls = new Map<string, HTMLElement>()
const cardRefCallbacks = new Map<string, (el: Element | null) => void>()
const pendingCardMeasure = new Set<string>()
let cardMeasureScheduled = false

// Deliberately nextTick-only (no requestAnimationFrame): reading
// scrollHeight/clientHeight forces a synchronous layout pass, so the
// measurement is accurate as soon as Vue has patched the DOM — no need to
// wait for a paint. This also keeps it deterministic under headless/virtual
// time testing, where rAF timing is not reliable.
function scheduleCardMeasure(slug: string) {
  pendingCardMeasure.add(slug)
  if (cardMeasureScheduled)
    return
  cardMeasureScheduled = true
  nextTick(() => {
    cardMeasureScheduled = false
    const slugs = [...pendingCardMeasure]
    pendingCardMeasure.clear()
    slugs.forEach(s => checkCardOverflow(s))
  })
}

function checkCardOverflow(slug: string) {
  const el = cardEls.get(slug)
  if (!el || !el.isConnected)
    return
  if (el.scrollHeight <= el.clientHeight + 1)
    return
  const card = cardBySlug.value.get(slug)
  if (!card)
    return
  const order = tierOrderFor(card.talk)
  const current = cardTierOverride[slug] ?? card.tier
  const idx = order.indexOf(current)
  if (idx === -1 || idx >= order.length - 1)
    return // already at the leanest tier
  cardTierOverride[slug] = order[idx + 1]
  nextTick(() => checkCardOverflow(slug))
}

function getCardRefCallback(slug: string) {
  let fn = cardRefCallbacks.get(slug)
  if (!fn) {
    fn = (el: Element | null) => {
      if (el instanceof HTMLElement) {
        cardEls.set(slug, el)
        scheduleCardMeasure(slug)
      }
      else {
        cardEls.delete(slug)
      }
    }
    cardRefCallbacks.set(slug, fn)
  }
  return fn
}

// Any change that can alter a card's actual rendered size (zoom, text size,
// day, available height, which stages/columns are shown) invalidates prior
// downgrade decisions — clear overrides and re-measure from the fresh guess.
watch([fontScale, zoomMode, manualHourH, selectedDay, timelineAvailableHeight, timelineStages], () => {
  Object.keys(cardTierOverride).forEach(k => delete cardTierOverride[k])
  nextTick(() => {
    cardEls.forEach((_, slug) => scheduleCardMeasure(slug))
  })
})

// ── Manual-zoom auto-scroll (keeps the now-line in the upper third) ──
const userScrollingTimeline = ref(false)
let timelineScrollPauseTimer: ReturnType<typeof setTimeout>

function centerTimelineScroll(smooth = false) {
  if (zoomMode.value !== 'manual')
    return
  const el = timelineScrollRef.value
  if (!el || nowLineTopBody.value === null)
    return
  const target = STAGE_HEADER_H + nowLineTopBody.value - el.clientHeight / 3
  const maxScroll = el.scrollHeight - el.clientHeight
  const actual = Math.max(0, Math.min(target, maxScroll))
  el.scrollTo({ top: actual, behavior: smooth ? 'smooth' : 'instant' })
}

function onTimelineUserScroll() {
  userScrollingTimeline.value = true
  clearTimeout(timelineScrollPauseTimer)
  timelineScrollPauseTimer = setTimeout(() => {
    userScrollingTimeline.value = false
    centerTimelineScroll(true)
  }, 3000)
}

watch([nowLineTopBody, zoomMode, selectedDay], () => {
  if (!userScrollingTimeline.value)
    nextTick(() => centerTimelineScroll(true))
})
onUnmounted(() => clearTimeout(timelineScrollPauseTimer))

// ── Stage list (Run of Show) ────────────────────────────────────
const stageListTalks = computed(() =>
  dayTalks.value
    .filter(t => t.stageObject?.slug === effectiveSingleStageSlug.value)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis()),
)

// Finished talks are dropped so the running one always sits at the top,
// where it is readable from across the room
const upcomingStageListTalks = computed(() =>
  stageListTalks.value.filter(t => talkStatus(t) !== 'past'))

const currentListTalk = computed(() =>
  stageListTalks.value.find(t => t.start <= now.value && t.end > now.value) ?? null)
const nextListTalk = computed(() => stageListTalks.value.find(t => t.start > now.value) ?? null)

type StageListState = 'live' | 'upcoming' | 'finished' | 'empty'
const stageListState = computed<StageListState>(() => {
  if (!stageListTalks.value.length)
    return 'empty'
  if (currentListTalk.value)
    return 'live'
  if (nextListTalk.value)
    return 'upcoming'
  return 'finished'
})

function isNextListTalk(talk: any): boolean {
  return nextListTalk.value?.slug === talk.slug
}

function untilTalkSeconds(talk: any): number {
  return Math.max(0, Math.floor(talk.start.diff(now.value, 'seconds').seconds))
}

function listItemClasses(talk: any): (string | false)[] {
  const status = talkStatus(talk)
  const isNext = status !== 'live' && isNextListTalk(talk)
  return [
    `stagelist-item--${status}`,
    isNext && 'stagelist-item--next',
    // With nothing running, the next item carries the screen on its own
    isNext && !currentListTalk.value && 'stagelist-item--next-hero',
  ]
}

const stageListScrollRef = ref<HTMLElement | null>(null)
const stageListItemEls = new Map<string, HTMLElement>()

function setStageListItemRef(el: unknown, slug: string) {
  if (el instanceof HTMLElement)
    stageListItemEls.set(slug, el)
  else stageListItemEls.delete(slug)
}

const userScrollingList = ref(false)
let listScrollPauseTimer: ReturnType<typeof setTimeout>

function centerListScroll(smooth = false) {
  const el = stageListScrollRef.value
  const anchor = currentListTalk.value ?? nextListTalk.value
  if (!el || !anchor)
    return
  const anchorEl = stageListItemEls.get(anchor.slug)
  if (!anchorEl)
    return
  const target = anchorEl.offsetTop - el.clientHeight * 0.28
  const maxScroll = el.scrollHeight - el.clientHeight
  const actual = Math.max(0, Math.min(target, maxScroll))
  el.scrollTo({ top: actual, behavior: smooth ? 'smooth' : 'instant' })
}

function onListUserScroll() {
  userScrollingList.value = true
  clearTimeout(listScrollPauseTimer)
  listScrollPauseTimer = setTimeout(() => {
    userScrollingList.value = false
    centerListScroll(true)
  }, 3000)
}

watch([currentListTalk, nextListTalk, effectiveSingleStageSlug, selectedDay, viewMode], () => {
  nextTick(() => centerListScroll(true))
})
onUnmounted(() => clearTimeout(listScrollPauseTimer))

// ── Config panel ──────────────────────────────────────────────
const showConfig = ref(false)
const isFullscreen = ref(false)
let hideConfigTimer: ReturnType<typeof setTimeout>

function openConfig() {
  showConfig.value = true
  scheduleHide()
}

function scheduleHide() {
  clearTimeout(hideConfigTimer)
  hideConfigTimer = setTimeout(() => {
    showConfig.value = false
  }, 5000)
}

function keepOpen() {
  scheduleHide()
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen()
  }
  else {
    await document.exitFullscreen()
  }
  scheduleHide()
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function setManualDate(date: string) {
  autoMode.value = false
  manualDate.value = date
  saveSettings()
  scheduleHide()
}

function setAutoMode() {
  autoMode.value = true
  manualDate.value = ''
  saveSettings()
  scheduleHide()
}

// ── localStorage persistence ────────────────────────────────
function loadSettings() {
  if (typeof localStorage === 'undefined')
    return
  try {
    const raw = localStorage.getItem('screen2-settings')
    if (!raw)
      return
    const p = JSON.parse(raw)
    if (typeof p.autoMode === 'boolean')
      autoMode.value = p.autoMode
    if (p.manualDate)
      manualDate.value = p.manualDate
    if (p.timeOverride)
      applyTimeOverride(p.timeOverride)
    if (p.viewMode === 'timeline' || p.viewMode === 'stagelist')
      viewMode.value = p.viewMode
    if (Array.isArray(p.visibleStageSlugs) && p.visibleStageSlugs.length)
      visibleStageSlugs.value = new Set(p.visibleStageSlugs)
    if (typeof p.singleStageSlug === 'string')
      singleStageSlug.value = p.singleStageSlug
    if (typeof p.fontScale === 'number')
      fontScale.value = p.fontScale
    if (p.zoomMode === 'fit' || p.zoomMode === 'manual')
      zoomMode.value = p.zoomMode
    if (typeof p.manualHourH === 'number')
      manualHourH.value = p.manualHourH
    if (typeof p.showSponsors === 'boolean')
      showSponsors.value = p.showSponsors
    // A stored image is deliberately not restored: it lives in one browser
    // only, and there is no way to clear it from afar. The deployed file
    // wins, so every screen shows the same wall.
  }
  catch {}
  validateStageSelection()
}

// Returns false (instead of throwing) when the write fails — e.g.
// QuotaExceededError from a large sponsor image data URL — so callers can
// react (see onSponsorImageUpload) instead of the page breaking.
function saveSettings(): boolean {
  if (typeof localStorage === 'undefined')
    return true
  try {
    localStorage.setItem('screen2-settings', JSON.stringify({
      autoMode: autoMode.value,
      manualDate: manualDate.value,
      timeOverride: timeOverride.value,
      viewMode: viewMode.value,
      visibleStageSlugs: [...visibleStageSlugs.value],
      singleStageSlug: singleStageSlug.value,
      fontScale: fontScale.value,
      zoomMode: zoomMode.value,
      manualHourH: manualHourH.value,
      showSponsors: showSponsors.value,
      sponsorImageUrl: sponsorImageUrl.value,
    }))
    return true
  }
  catch {
    return false
  }
}

watch(
  [autoMode, manualDate, fontScale, viewMode, singleStageSlug, zoomMode, manualHourH, showSponsors, sponsorImageUrl],
  saveSettings,
)
watch(visibleStageSlugs, saveSettings)

onMounted(() => {
  loadSettings()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  nextTick(() => {
    centerTimelineScroll(false)
    centerListScroll(false)
  })
  // Safety net: web font metrics can differ slightly from the fallback font
  // used for the very first measurement pass. Once the real font is loaded,
  // re-check every currently mounted card once more.
  document.fonts?.ready.then(() => {
    nextTick(() => {
      cardEls.forEach((_, slug) => scheduleCardMeasure(slug))
    })
  })
})

onUnmounted(() => {
  clearTimeout(hideConfigTimer)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div class="screen-outer">
    <!-- ── Config overlay (outside zoom) ─────────────────────── -->
    <Transition name="fade">
      <div
        v-if="showConfig"
        class="config-panel"
        @click.self="showConfig = false"
        @mousemove="keepOpen"
      >
        <div class="config-inner">
          <p class="config-label">
            Settings
          </p>

          <!-- Fullscreen -->
          <button
            class="config-btn"
            @click="toggleFullscreen"
          >
            <UIcon
              class="config-btn-icon"
              :name="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
            />
            {{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
          </button>

          <!-- Date -->
          <div class="config-section">
            <p class="config-section-label">
              Date
            </p>
            <div class="config-date-row">
              <button
                class="config-date-btn"
                :class="[autoMode && 'config-date-btn--active']"
                @click="setAutoMode"
              >
                Auto
              </button>
              <button
                v-for="day in availableDays"
                :key="day"
                class="config-date-btn"
                :class="[!autoMode && selectedDay === day && 'config-date-btn--active']"
                @click="setManualDate(day)"
              >
                {{ fmtDayLabel(day) }}
              </button>
            </div>
          </div>

          <!-- Time simulation -->
          <div class="config-section">
            <p class="config-section-label">
              Simulate time
            </p>
            <div class="config-time-row">
              <input
                class="config-time-input"
                :class="isTimeOverride && 'config-time-input--active'"
                type="time"
                :value="timeOverride"
                @change="applyTimeOverride(($event.target as HTMLInputElement).value); saveSettings()"
                @click.stop
              >
              <button
                v-if="isTimeOverride"
                class="config-date-btn"
                @click="applyTimeOverride(''); saveSettings()"
              >
                Reset
              </button>
            </div>
            <p
              v-if="isTimeOverride"
              class="config-time-hint"
            >
              Simulating {{ timeOverride }} — clock running forward
            </p>
          </div>

          <!-- View -->
          <div class="config-section">
            <p class="config-section-label">
              View
            </p>
            <div class="config-date-row">
              <button
                class="config-date-btn"
                :class="[viewMode === 'timeline' && 'config-date-btn--active']"
                @click="viewMode = 'timeline'; scheduleHide()"
              >
                Timeline
              </button>
              <button
                class="config-date-btn"
                :class="[viewMode === 'stagelist' && 'config-date-btn--active']"
                @click="viewMode = 'stagelist'; scheduleHide()"
              >
                Stage list
              </button>
            </div>
          </div>

          <!-- Stages -->
          <div class="config-section">
            <p class="config-section-label">
              {{ viewMode === 'timeline' ? 'Stages shown' : 'Stage' }}
            </p>
            <div class="config-date-row">
              <template v-if="viewMode === 'timeline'">
                <button
                  v-for="stage in orderedStages"
                  :key="stage.slug"
                  class="config-date-btn"
                  :class="[visibleStageSlugs.has(stage.slug) && 'config-date-btn--active']"
                  @click="toggleVisibleStage(stage.slug)"
                >
                  {{ stage.name }}
                </button>
              </template>
              <template v-else>
                <button
                  v-for="stage in orderedStages"
                  :key="stage.slug"
                  class="config-date-btn"
                  :class="[effectiveSingleStageSlug === stage.slug && 'config-date-btn--active']"
                  @click="singleStageSlug = stage.slug; scheduleHide()"
                >
                  {{ stage.name }}
                </button>
              </template>
            </div>
          </div>

          <!-- Font size -->
          <div class="config-section">
            <p class="config-section-label">
              Text Size
            </p>
            <div class="config-font-row">
              <span class="config-font-a config-font-a--sm">A</span>
              <input
                v-model.number="fontScale"
                class="config-font-slider"
                max="1.35"
                min="0.8"
                step="0.05"
                type="range"
                @click.stop
              >
              <span class="config-font-a config-font-a--lg">A</span>
              <button
                v-if="fontScale !== 1"
                class="config-date-btn"
                @click="fontScale = 1; scheduleHide()"
              >
                Reset
              </button>
            </div>
          </div>

          <!-- Timeline zoom -->
          <div class="config-section">
            <p class="config-section-label">
              Timeline zoom
            </p>
            <div class="config-date-row">
              <button
                class="config-date-btn"
                :class="[zoomMode === 'fit' && 'config-date-btn--active']"
                @click="zoomMode = 'fit'; scheduleHide()"
              >
                Fit day
              </button>
            </div>
            <div class="config-time-row" style="margin-top: 8px">
              <input
                v-model.number="manualHourH"
                class="config-font-slider"
                max="400"
                min="60"
                step="10"
                type="range"
                @click.stop
                @input="zoomMode = 'manual'"
              >
              <span class="config-zoom-value">{{ zoomMode === 'manual' ? `${manualHourH}px/h` : 'auto' }}</span>
            </div>
          </div>

          <!-- Sponsors -->
          <div class="config-section">
            <p class="config-section-label">
              Sponsors
            </p>
            <button
              class="config-btn"
              :class="[showSponsors && 'config-btn--active']"
              @click="showSponsors = !showSponsors; scheduleHide()"
            >
              <UIcon
                class="config-btn-icon"
                :name="showSponsors ? 'i-lucide-eye' : 'i-lucide-eye-off'"
              />
              {{ showSponsors ? 'Shown' : 'Hidden' }}
            </button>
            <div class="config-time-row" style="margin-top: 8px">
              <input
                v-model="sponsorImageUrl"
                class="config-time-input config-url-input"
                placeholder="https://..."
                type="url"
                @change="saveSettings()"
                @click.stop
              >
              <button
                v-if="sponsorImageUrl"
                class="config-date-btn"
                @click="sponsorImageUrl = ''; saveSettings()"
              >
                Clear
              </button>
            </div>
            <div class="config-time-row" style="margin-top: 8px">
              <label class="config-upload-btn" @click.stop>
                <UIcon class="config-btn-icon" name="i-lucide-image" />
                Upload image
                <input
                  accept="image/*"
                  style="display:none"
                  type="file"
                  @change="onSponsorImageUpload"
                  @click.stop
                >
              </label>
            </div>
            <p
              v-if="uploadNotice"
              class="config-time-hint"
            >
              {{ uploadNotice }}
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Scaled content root ───────────────────────────────── -->
    <div class="screen-root" :style="{ '--font-scale': fontScale }">
      <!-- ── Header bar ──────────────────────────────────────── -->
      <header class="screen-header">
        <button
          aria-label="Open settings"
          class="logo-btn"
          @click="openConfig"
        >
          <NuxtImg
            alt="PRINTED"
            class="logo-img"
            :src="logoPath"
          />
        </button>
        <span class="clock-time">{{ clockDisplay }}</span>
      </header>

      <!-- ── Body ────────────────────────────────────────────── -->
      <div ref="screenBodyRef" class="screen-body">
        <!-- ── Timeline view ───────────────────────────────── -->
        <div v-if="viewMode === 'timeline'" class="timeline-view">
          <div v-if="!dayTalks.length" class="empty-state">
            <p>No programme scheduled for this day.</p>
          </div>
          <div v-else-if="!timelineStages.length" class="empty-state">
            <p>No stages selected. Open settings to choose stages.</p>
          </div>
          <div
            v-else
            ref="timelineScrollRef"
            class="timeline-scroll"
            @scroll.passive="onTimelineUserScroll"
          >
            <div class="timeline-inner">
              <!-- Time axis -->
              <div class="time-axis">
                <div class="axis-header-spacer" :style="{ height: `${STAGE_HEADER_H}px` }" />
                <div class="axis-body" :style="{ height: `${bodyHeightPx}px` }">
                  <span
                    v-if="nowLineTopBody !== null"
                    class="now-axis-dot"
                    :style="{ top: `${nowLineTopBody}px` }"
                  />
                  <div
                    v-for="m in timelineHourMarks"
                    :key="m.toISO()"
                    class="time-mark"
                    :style="{ top: `${markTop(m)}px` }"
                  >
                    {{ m.toFormat('HH:mm') }}
                  </div>
                </div>
              </div>

              <!-- Stage columns -->
              <div class="stage-columns">
                <div
                  v-if="nowLineTopBody !== null"
                  class="now-line"
                  :style="{ top: `${STAGE_HEADER_H + nowLineTopBody}px` }"
                />
                <div
                  v-for="stage in timelineStages"
                  :key="stage.slug"
                  class="stage-col"
                >
                  <div class="stage-col-header" :style="{ height: `${STAGE_HEADER_H}px` }">
                    {{ stage.name }}
                  </div>
                  <div class="stage-col-body" :style="{ height: `${bodyHeightPx}px` }">
                    <div
                      v-for="m in timelineHourMarks"
                      :key="`g-${m.toISO()}`"
                      class="hour-grid-line"
                      :style="{ top: `${markTop(m)}px` }"
                    />
                    <div
                      v-for="card in stageCards(stage.slug)"
                      :key="card.talk.slug"
                      :ref="getCardRefCallback(card.talk.slug)"
                      class="talk-card"
                      :class="[`talk-card--${effectiveTier(card)}`, `talk-card--${talkStatus(card.talk)}`]"
                      :style="card.style"
                    >
                      <!-- Compact: single line "HH:mm Title" -->
                      <template v-if="effectiveTier(card) === 'compact'">
                        <p class="talk-card-compact-line">
                          <span v-if="talkStatus(card.talk) === 'live'" class="live-dot talk-card-live-dot" />
                          <span class="talk-card-compact-time">{{ fmtTime(card.talk.start) }}</span>
                          {{ card.talk.title }}
                        </p>
                      </template>

                      <!-- Brief: type/time + title, no speaker (fits when medium doesn't) -->
                      <template v-else-if="effectiveTier(card) === 'brief'">
                        <div class="talk-card-meta">
                          <span class="talk-card-type">
                            <span v-if="talkStatus(card.talk) === 'live'" class="live-dot talk-card-live-dot" />
                            {{ card.talk.type }}
                          </span>
                          <span class="talk-card-time">{{ fmtTime(card.talk.start) }}</span>
                        </div>
                        <p class="talk-card-title talk-card-title--clamp2">
                          {{ card.talk.title }}
                        </p>
                      </template>

                      <!-- Medium: type/time + title (2 lines) + speaker name -->
                      <template v-else-if="effectiveTier(card) === 'medium'">
                        <div class="talk-card-meta">
                          <span class="talk-card-type">
                            <span v-if="talkStatus(card.talk) === 'live'" class="live-dot talk-card-live-dot" />
                            {{ card.talk.type }}
                          </span>
                          <span class="talk-card-time">{{ fmtTime(card.talk.start) }}</span>
                        </div>
                        <p class="talk-card-title talk-card-title--clamp2">
                          {{ card.talk.title }}
                        </p>
                        <p v-if="card.talk.speakerObjects.length" class="talk-card-speaker-line">
                          {{ speakerNames(card.talk) }}
                        </p>
                      </template>

                      <!-- Full: everything -->
                      <template v-else>
                        <div class="talk-card-meta">
                          <span class="talk-card-type">
                            <span v-if="talkStatus(card.talk) === 'live'" class="live-dot talk-card-live-dot" />
                            {{ card.talk.type }}
                          </span>
                          <span class="talk-card-time">{{ fmtTime(card.talk.start) }}–{{
                            fmtTime(card.talk.end) }}</span>
                        </div>
                        <p class="talk-card-title">
                          {{ card.talk.title }}
                        </p>
                        <div v-if="card.talk.speakerObjects.length" class="talk-card-speakers">
                          <div class="talk-card-avatar-stack">
                            <NuxtImg
                              v-for="sp in card.talk.speakerObjects.filter((s: any) => s.image).slice(0, 2)"
                              :key="sp.slug"
                              :alt="sp.name"
                              class="talk-card-avatar"
                              :src="sp.image"
                            />
                          </div>
                          <span class="talk-card-speaker-line">{{ speakerNames(card.talk) }}</span>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Stage list view ─────────────────────────────── -->
        <div v-else class="stagelist-view">
          <div class="stagelist-header">
            <h1 class="stagelist-stage-name">
              {{ singleStageName }}
            </h1>
            <p class="stagelist-date">
              {{ fmtDayLabelLong(selectedDay) }}
            </p>
          </div>

          <div
            v-if="stageListState === 'finished' || stageListState === 'empty'"
            class="stagelist-banner"
            :class="`stagelist-banner--${stageListState}`"
          >
            <template v-if="stageListState === 'finished'">
              <p class="banner-finished">
                Programme finished for today
              </p>
            </template>
            <template v-else>
              <p class="banner-finished">
                No programme scheduled for {{ singleStageName }} today
              </p>
            </template>
          </div>

          <div
            v-if="upcomingStageListTalks.length"
            ref="stageListScrollRef"
            class="stagelist-scroll"
            @scroll.passive="onListUserScroll"
          >
            <ul class="stagelist-list">
              <li
                v-for="talk in upcomingStageListTalks"
                :key="talk.slug"
                :ref="(el) => setStageListItemRef(el, talk.slug)"
                class="stagelist-item"
                :class="listItemClasses(talk)"
              >
                <template v-if="talkStatus(talk) === 'live'">
                  <div class="list-live-top">
                    <p class="list-live-label">
                      <span class="live-dot" />Now Live
                    </p>
                    <span class="list-time">{{ fmtTime(talk.start) }}–{{ fmtTime(talk.end) }}</span>
                  </div>
                  <h2 class="list-title">
                    {{ talk.title }}
                  </h2>
                  <div class="talk-type-badge">
                    {{ talk.type }}
                  </div>
                  <div v-if="talk.speakerObjects.length" class="list-speakers">
                    <div class="list-avatar-stack">
                      <NuxtImg
                        v-for="sp in talk.speakerObjects.filter((s: any) => s.image).slice(0, 2)"
                        :key="sp.slug"
                        :alt="sp.name"
                        class="list-avatar"
                        :src="sp.image"
                      />
                    </div>
                    <span class="list-speaker-names">{{ speakerNames(talk) }}</span>
                  </div>
                  <div class="list-progress">
                    <div class="list-progress-labels">
                      <span class="list-progress-elapsed">{{ fmtTimer(elapsedSecondsFor(talk)) }}</span>
                      <span class="list-progress-remain">{{ fmtTimer(remainingSecondsFor(talk)) }}</span>
                    </div>
                    <div class="list-progress-track">
                      <div class="list-progress-fill" :style="{ width: `${progressFor(talk)}%` }" />
                    </div>
                  </div>
                </template>
                <template v-else-if="isNextListTalk(talk)">
                  <div class="list-live-top">
                    <p class="list-next-label">
                      Next
                    </p>
                    <span class="list-time">{{ fmtTime(talk.start) }}–{{ fmtTime(talk.end) }}</span>
                  </div>
                  <h2 class="list-title list-title--next">
                    {{ talk.title }}
                  </h2>
                  <div class="talk-type-badge">
                    {{ talk.type }}
                  </div>
                  <div v-if="talk.speakerObjects.length" class="list-speakers">
                    <div class="list-avatar-stack">
                      <NuxtImg
                        v-for="sp in talk.speakerObjects.filter((s: any) => s.image).slice(0, 2)"
                        :key="sp.slug"
                        :alt="sp.name"
                        class="list-avatar"
                        :src="sp.image"
                      />
                    </div>
                    <span class="list-speaker-names">{{ speakerNames(talk) }}</span>
                  </div>
                  <p class="list-next-countdown">
                    <span class="list-next-countdown-value">{{ fmtCountdown(untilTalkSeconds(talk)) }}</span>
                    <span class="list-next-countdown-label">until start</span>
                  </p>
                </template>
                <template v-else>
                  <div class="list-row">
                    <UIcon
                      v-if="talkStatus(talk) === 'past'"
                      class="list-check"
                      name="i-lucide-check"
                    />
                    <span class="list-time-sm">{{ fmtTime(talk.start) }}–{{ fmtTime(talk.end) }}</span>
                    <span class="talk-type-badge talk-type-badge--small">{{ talk.type }}</span>
                    <span class="list-duration">{{ talk.duration ?? 30 }} min</span>
                    <span v-if="isNextListTalk(talk)" class="list-next-tag">in {{
                      fmtCountdownHM(untilTalkSeconds(talk)) }}</span>
                  </div>
                  <p class="list-title-sm">
                    {{ talk.title }}
                  </p>
                  <div v-if="talk.speakerObjects.length" class="list-speakers list-speakers--sm">
                    <div class="list-avatar-stack">
                      <NuxtImg
                        v-for="sp in talk.speakerObjects.filter((s: any) => s.image).slice(0, 2)"
                        :key="sp.slug"
                        :alt="sp.name"
                        class="list-avatar list-avatar--sm"
                        :src="sp.image"
                      />
                    </div>
                    <span class="list-speaker-names">{{ speakerNames(talk) }}</span>
                  </div>
                </template>
              </li>
            </ul>
          </div>
          <div v-else class="empty-state">
            <p>No programme scheduled for {{ singleStageName }} today.</p>
          </div>
        </div>

        <!-- ── Sponsor column ──────────────────────────────── -->
        <!-- Deliberately a single static, centered image — no logo list, no animation -->
        <aside
          v-if="showSponsors"
          ref="sponsorColRef"
          class="sponsor-col"
          :style="sponsorColWidthPx !== null ? { width: `${sponsorColWidthPx}px` } : undefined"
        >
          <div ref="sponsorImgWrapRef" class="sponsor-img-wrap">
            <img
              v-if="sponsorImageUrl && !sponsorImageError"
              alt="Sponsors"
              class="sponsor-image"
              :src="sponsorImageUrl"
              @error="sponsorImageError = true"
              @load="onSponsorImageLoad"
            >
            <div v-else class="sponsor-placeholder">
              <UIcon name="i-lucide-image" />
            </div>
          </div>
        </aside>
      </div>
    </div><!-- /screen-root -->
  </div><!-- /screen-outer -->
</template>

<style scoped>
/* ── Root ───────────────────────────────────────────────────── */
.screen-outer {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #080808;
}

.screen-root {
  width: calc(100vw / var(--font-scale, 1));
  height: calc(100dvh / var(--font-scale, 1));
  transform: scale(var(--font-scale, 1));
  transform-origin: top left;
  display: flex;
  flex-direction: column;
  background: #080808;
  color: #fff;
  font-family: 'Public Sans', sans-serif;
  overflow: hidden;
  position: relative;
}

/* ── Config overlay (copied 1:1 from screen1 for visual consistency) ── */
.config-panel {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 80px 24px 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}

.config-inner {
  background: rgba(20, 20, 28, 0.95);
  border: 1px solid rgba(255, 145, 77, 0.25);
  border-radius: 14px;
  padding: 20px 24px;
  min-width: 240px;
  max-height: calc(100dvh - 120px);
  overflow-y: auto;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}

.config-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0 14px;
}

.config-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 145, 77, 0.1);
  color: #ff914d;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.config-btn:hover {
  background: rgba(255, 145, 77, 0.2);
}

.config-btn--active {
  background: rgba(255, 145, 77, 0.15);
  border-color: rgba(255, 145, 77, 0.4);
  color: #ff914d;
}

.config-btn-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.config-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.config-section-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  margin: 0 0 10px;
}

.config-date-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-date-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    color 0.15s;
}

.config-date-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.config-date-btn--active {
  background: rgba(255, 145, 77, 0.15);
  border-color: rgba(255, 145, 77, 0.4);
  color: #ff914d;
  font-weight: 700;
}

.config-time-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.config-time-input {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s;
  color-scheme: dark;
}

.config-time-input:focus {
  outline: none;
  border-color: rgba(255, 145, 77, 0.4);
}

.config-time-input--active {
  border-color: rgba(255, 145, 77, 0.4);
  background: rgba(255, 145, 77, 0.1);
  color: #ff914d;
}

.config-time-hint {
  font-size: 0.72rem;
  color: rgba(255, 145, 77, 0.7);
  margin: 6px 0 0;
}

.config-font-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.config-font-slider {
  flex: 1;
  accent-color: #ff914d;
  cursor: pointer;
  height: 4px;
}

.config-font-a {
  font-weight: 800;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1;
  flex-shrink: 0;
}

.config-font-a--sm {
  font-size: 0.8rem;
}

.config-font-a--lg {
  font-size: 1.3rem;
}

.config-zoom-value {
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
  min-width: 52px;
  text-align: right;
}

/* ── Transition ─────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Header ─────────────────────────────────────────────────── */
.screen-header {
  flex-shrink: 0;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.logo-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 10px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
}

.logo-btn:hover {
  background: rgba(255, 145, 77, 0.12);
}

.logo-img {
  height: 40px;
  width: auto;
}

.clock-time {
  font-family: 'Inter', 'Public Sans', sans-serif;
  font-size: 2.4rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: #ff914d;
  line-height: 1;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53e3e;
  flex-shrink: 0;
  display: inline-block;
  animation: pulse 1.8s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

/* ── Body layout ────────────────────────────────────────────── */
.screen-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
}

.timeline-view,
.stagelist-view {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.empty-state p {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.2);
  text-align: center;
}

/* ── Timeline ───────────────────────────────────────────────── */
.timeline-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scrollbar-width: none;
}

.timeline-scroll::-webkit-scrollbar {
  display: none;
}

.timeline-inner {
  display: flex;
  padding: 8px 20px 20px;
}

.time-axis {
  width: 56px;
  flex-shrink: 0;
}

.axis-body {
  position: relative;
}

.now-axis-dot {
  position: absolute;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53e3e;
  transform: translate(50%, -50%);
  z-index: 20;
  box-shadow: 0 0 6px rgba(229, 62, 62, 0.9);
}

.time-mark {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.3);
}

.stage-columns {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
  gap: 10px;
}

.now-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px solid #e53e3e;
  box-shadow: 0 0 14px rgba(229, 62, 62, 0.5);
  z-index: 15;
  pointer-events: none;
}

.stage-col {
  flex: 1;
  min-width: 150px;
  display: flex;
  flex-direction: column;
}

.stage-col-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 8px;
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.01em;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  margin-bottom: 6px;
  /* A long stage name must never grow taller than its fixed-height box and
     bleed into the cards below. */
  overflow: hidden;
}

.stage-col-body {
  position: relative;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.015);
}

.hour-grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.045);
}

/* ── Talk cards ─────────────────────────────────────────────── */
.talk-card {
  position: absolute;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.045);
  padding: 6px 9px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-sizing: border-box;
}

.talk-card--full {
  padding: 10px 12px;
  gap: 6px;
}

.talk-card--live {
  border-color: rgba(255, 145, 77, 0.55);
  background: linear-gradient(135deg, rgba(255, 145, 77, 0.16) 0%, rgba(255, 255, 255, 0.03) 70%);
}

.talk-card--past {
  opacity: 0.4;
  filter: saturate(0.5);
}

.talk-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-shrink: 0;
}

.talk-card-type {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #ff914d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.talk-card-live-dot {
  flex-shrink: 0;
}

.talk-card-time {
  font-size: 0.68rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.talk-card-title {
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.28;
  color: #fff;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  /* Without this, flexbox treats an element with its own overflow:hidden as
     having an automatic min-height of 0, so a cramped card would silently
     flex-shrink the title below its clamped line height instead of the
     card ever registering overflow — clipping text mid-line without the
     JS overflow check (see checkCardOverflow) ever detecting it. */
  flex-shrink: 0;
}

.talk-card--full .talk-card-title {
  font-size: 0.92rem;
}

.talk-card-title--clamp2 {
  -webkit-line-clamp: 2;
}

.talk-card-speakers {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.talk-card-avatar-stack {
  display: flex;
  flex-direction: row;
}

.talk-card-avatar {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  object-fit: cover;
  border: 1.5px solid rgba(255, 145, 77, 0.4);
  margin-left: -8px;
  flex-shrink: 0;
}

.talk-card-avatar:first-child {
  margin-left: 0;
}

.talk-card-speaker-line {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  flex-shrink: 0;
}

.talk-card-compact-line {
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
  line-height: 1.3;
}

.talk-card-compact-time {
  font-variant-numeric: tabular-nums;
  color: #ff914d;
  font-weight: 800;
  margin-right: 4px;
}

.talk-card-compact-line .talk-card-live-dot {
  margin-right: 4px;
}

/* ── Type badge (shared with stage list) ───────────────────── */
.talk-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 14px;
  border-radius: 20px;
  background: rgba(255, 145, 77, 0.15);
  border: 1px solid rgba(255, 145, 77, 0.3);
  color: #ff914d;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  width: fit-content;
}

.talk-type-badge--small {
  font-size: 0.62rem;
  padding: 2px 10px;
}

/* ── Stage list ─────────────────────────────────────────────── */
.stagelist-view {
  padding: 20px 32px 24px;
  gap: 14px;
}

.stagelist-header {
  flex-shrink: 0;
}

.stagelist-stage-name {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 800;
  margin: 0;
  color: #fff;
  letter-spacing: -0.01em;
}

.stagelist-date {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 4px 0 0;
  font-weight: 500;
}

.stagelist-banner {
  flex-shrink: 0;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 18px 24px;
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.stagelist-banner--upcoming {
  border-color: rgba(255, 145, 77, 0.3);
  background: rgba(255, 145, 77, 0.06);
}

.banner-label {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.banner-countdown {
  font-size: 2.2rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #ff914d;
  margin: 0;
}

.banner-finished {
  font-size: 1.05rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

.stagelist-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.stagelist-scroll::-webkit-scrollbar {
  display: none;
}

.stagelist-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stagelist-item {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 14px 20px;
}

.stagelist-item--past {
  opacity: 0.42;
  filter: saturate(0.6);
}

.stagelist-item--next {
  border-color: rgba(255, 145, 77, 0.35);
  background: rgba(255, 145, 77, 0.05);
  padding: 18px 24px;
}

.stagelist-item--next-hero {
  border-color: rgba(255, 145, 77, 0.55);
  background: linear-gradient(135deg, rgba(255, 145, 77, 0.1) 0%, rgba(255, 255, 255, 0.03) 70%);
  padding: 22px 28px;
}

.list-next-label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #ff914d;
  margin: 0;
}

.list-title--next {
  font-size: clamp(1.3rem, 2vw, 1.9rem);
}

.list-next-countdown {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 4px 0 0;
}

.list-next-countdown-value {
  font-size: 1.7rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #ff914d;
  line-height: 1;
}

.list-next-countdown-label {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
}

.stagelist-item--live {
  border-color: rgba(255, 145, 77, 0.6);
  background: linear-gradient(135deg, rgba(255, 145, 77, 0.14) 0%, rgba(255, 255, 255, 0.03) 70%);
  padding: 22px 28px;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.list-check {
  color: rgba(63, 185, 80, 0.75);
  font-size: 0.95rem;
  flex-shrink: 0;
}

.list-time-sm {
  font-size: 0.9rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
}

.list-duration {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.list-next-tag {
  margin-left: auto;
  font-size: 0.8rem;
  font-weight: 700;
  color: #ff914d;
  flex-shrink: 0;
}

.list-title-sm {
  font-size: 1.05rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 6px 0 0;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.list-live-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.list-live-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #e53e3e;
  margin: 0;
}

.list-time {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.5);
}

.list-title {
  font-size: clamp(1.4rem, 2.4vw, 2.1rem);
  font-weight: 800;
  line-height: 1.2;
  margin: 10px 0 12px;
  color: #fff;
}

.list-speakers {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.list-speakers--sm {
  margin-top: 6px;
}

.list-avatar-stack {
  display: flex;
  flex-direction: row;
  flex-shrink: 0;
}

.list-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  border: 2px solid rgba(255, 145, 77, 0.4);
  margin-left: -12px;
  flex-shrink: 0;
}

.list-avatar--sm {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  margin-left: -8px;
}

.list-avatar:first-child {
  margin-left: 0;
}

.list-speaker-names {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-progress {
  margin-top: 18px;
}

.list-progress-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 2px 6px;
}

.list-progress-elapsed {
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.35);
}

.list-progress-remain {
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #ff914d;
}

.list-progress-track {
  position: relative;
  height: 18px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 9px;
  overflow: hidden;
}

.list-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 145, 77, 0.3), rgba(255, 145, 77, 0.85));
  border-radius: 9px 0 0 9px;
  transition: width 1s linear;
}

/* ── Sponsor column ─────────────────────────────────────────── */
/* A single static, centered image — dark column background (never white),
   the image never exceeds the column width or the column height, and it
   never moves. */
.sponsor-col {
  /* content-box so the derived width stays the width available to the
     image itself — the padding is added around it by the box model */
  box-sizing: content-box;
  flex-shrink: 0;
  width: 21%;
  min-width: 160px;
  border-left: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.015);
  overflow: hidden;
  padding: 20px 16px;
  display: flex;
}

.sponsor-img-wrap {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sponsor-image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sponsor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 2px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  font-size: 2.4rem;
  color: rgba(255, 255, 255, 0.18);
}

/* ── Config upload button (mirrors screen1) ──────────────────── */
.config-upload-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.config-upload-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
</style>
