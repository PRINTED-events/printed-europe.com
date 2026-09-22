<script setup lang="ts">
import { DateTime } from 'luxon'

definePageMeta({ layout: false })

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
const { data: indexPage, refresh: refreshIndex } = await useAsyncData(
  'screen2-index',
  () => queryCollection('index').path('/').first(),
)

// Auto-refresh data every 60 seconds
let refreshTimer: ReturnType<typeof setInterval>
onMounted(() => {
  refreshTimer = setInterval(() => {
    refreshTalks()
    refreshSpeakers()
    refreshStages()
    refreshIndex()
  }, 60_000)
})
onUnmounted(() => clearInterval(refreshTimer))

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
const showSponsors = ref(false)

interface SponsorLogo { src: string, alt: string }
interface SponsorGroup { headline: string, logos: SponsorLogo[] }

const sponsorGroups = computed<SponsorGroup[]>(() => {
  const blocks = (indexPage.value as any)?.blocks ?? []
  const seen = new Set<string>()
  const groups: SponsorGroup[] = []
  for (const block of blocks) {
    if (block?.component !== 'AppLandingLogoGrid')
      continue
    const logos: SponsorLogo[] = []
    for (const logo of block.logos ?? []) {
      if (!logo?.src || seen.has(logo.src))
        continue
      seen.add(logo.src)
      logos.push({ src: logo.src, alt: logo.alt || '' })
    }
    if (logos.length)
      groups.push({ headline: block.headline || 'Sponsors', logos })
  }
  return groups
})

const sponsorColRef = ref<HTMLElement | null>(null)
const sponsorInnerRef = ref<HTMLElement | null>(null)
const sponsorOverflow = ref(false)
const sponsorScrollDuration = ref(30)
let sponsorObserver: ResizeObserver | null = null

function checkSponsorOverflow() {
  const col = sponsorColRef.value
  const inner = sponsorInnerRef.value
  if (!col || !inner) {
    sponsorOverflow.value = false
    return
  }
  const overflow = inner.scrollHeight > col.clientHeight + 4
  sponsorOverflow.value = overflow
  if (overflow)
    sponsorScrollDuration.value = Math.max(18, Math.round(inner.scrollHeight / 28))
}

watch(sponsorColRef, (el) => {
  sponsorObserver?.disconnect()
  sponsorObserver = null
  if (!el)
    return
  sponsorObserver = new ResizeObserver(() => checkSponsorOverflow())
  sponsorObserver.observe(el)
  nextTick(checkSponsorOverflow)
})
watch([showSponsors, sponsorGroups, fontScale], () => nextTick(checkSponsorOverflow))
onUnmounted(() => sponsorObserver?.disconnect())

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
const MIN_CARD_H = 16
const CARD_TIER_FULL = 130
const CARD_TIER_MEDIUM = 56

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
  const usable = Math.max(60, timelineAvailableHeight.value - STAGE_HEADER_H)
  return Math.max(20, usable / dayTotalHours.value)
})

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
  return (m.diff(dayBounds.value.start, 'minutes').minutes / 60) * pxPerHour.value
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
  return (now.value.diff(dayBounds.value.start, 'minutes').minutes / 60) * pxPerHour.value
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

interface TimelineCard { talk: any, tier: 'full' | 'medium' | 'compact', style: Record<string, string> }

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
      const top = (startMin / 60) * pxPerHour.value
      const height = Math.max(rawHeight - CARD_GAP, MIN_CARD_H)
      const colWidthPct = 100 / item.cols
      const tier: TimelineCard['tier'] = height >= CARD_TIER_FULL
        ? 'full'
        : height >= CARD_TIER_MEDIUM ? 'medium' : 'compact'
      return {
        talk: item.talk,
        tier,
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

const currentListTalk = computed(() =>
  stageListTalks.value.find(t => t.start <= now.value && t.end > now.value) ?? null)
const nextListTalk = computed(() => stageListTalks.value.find(t => t.start > now.value) ?? null)

const untilNextListSeconds = computed(() => {
  if (!nextListTalk.value)
    return null
  return Math.max(0, Math.floor(nextListTalk.value.start.diff(now.value, 'seconds').seconds))
})

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
  return [`stagelist-item--${status}`, status !== 'live' && isNextListTalk(talk) && 'stagelist-item--next']
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
  }
  catch {}
  validateStageSelection()
}

function saveSettings() {
  if (typeof localStorage === 'undefined')
    return
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
  }))
}

watch([autoMode, manualDate, fontScale, viewMode, singleStageSlug, zoomMode, manualHourH, showSponsors], saveSettings)
watch(visibleStageSlugs, saveSettings)

onMounted(() => {
  loadSettings()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  nextTick(() => {
    checkSponsorOverflow()
    centerTimelineScroll(false)
    centerListScroll(false)
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
      <div class="screen-body">
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
                <div class="axis-body" :style="{ height: `${dayTotalHours * pxPerHour}px` }">
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
                  <div class="stage-col-body" :style="{ height: `${dayTotalHours * pxPerHour}px` }">
                    <div
                      v-for="m in timelineHourMarks"
                      :key="`g-${m.toISO()}`"
                      class="hour-grid-line"
                      :style="{ top: `${markTop(m)}px` }"
                    />
                    <div
                      v-for="card in stageCards(stage.slug)"
                      :key="card.talk.slug"
                      class="talk-card"
                      :class="[`talk-card--${card.tier}`, `talk-card--${talkStatus(card.talk)}`]"
                      :style="card.style"
                    >
                      <!-- Compact: single line "HH:mm Title" -->
                      <template v-if="card.tier === 'compact'">
                        <p class="talk-card-compact-line">
                          <span v-if="talkStatus(card.talk) === 'live'" class="live-dot talk-card-live-dot" />
                          <span class="talk-card-compact-time">{{ fmtTime(card.talk.start) }}</span>
                          {{ card.talk.title }}
                        </p>
                      </template>

                      <!-- Medium: type/time + title (2 lines) + speaker name -->
                      <template v-else-if="card.tier === 'medium'">
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
            v-if="stageListState !== 'live'"
            class="stagelist-banner"
            :class="`stagelist-banner--${stageListState}`"
          >
            <template v-if="stageListState === 'upcoming'">
              <p class="banner-label">
                Next up in
              </p>
              <p class="banner-countdown">
                {{ fmtCountdown(untilNextListSeconds ?? 0) }}
              </p>
            </template>
            <template v-else-if="stageListState === 'finished'">
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
            v-if="stageListTalks.length"
            ref="stageListScrollRef"
            class="stagelist-scroll"
            @scroll.passive="onListUserScroll"
          >
            <ul class="stagelist-list">
              <li
                v-for="talk in stageListTalks"
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
        <aside v-if="showSponsors" ref="sponsorColRef" class="sponsor-col">
          <div
            class="sponsor-track"
            :class="{ 'sponsor-track--scroll': sponsorOverflow }"
            :style="sponsorOverflow ? { animationDuration: `${sponsorScrollDuration}s` } : {}"
          >
            <div ref="sponsorInnerRef" class="sponsor-inner">
              <template v-for="group in sponsorGroups" :key="group.headline">
                <p class="sponsor-group-label">
                  {{ group.headline }}
                </p>
                <div class="sponsor-logos">
                  <div
                    v-for="logo in group.logos"
                    :key="logo.src"
                    class="sponsor-logo-tile"
                  >
                    <img :alt="logo.alt" :src="logo.src">
                  </div>
                </div>
              </template>
              <p v-if="!sponsorGroups.length" class="sponsor-empty">
                No sponsor logos configured.
              </p>
            </div>
            <div v-if="sponsorOverflow" aria-hidden="true" class="sponsor-inner">
              <template v-for="group in sponsorGroups" :key="`dup-${group.headline}`">
                <p class="sponsor-group-label">
                  {{ group.headline }}
                </p>
                <div class="sponsor-logos">
                  <div
                    v-for="logo in group.logos"
                    :key="`dup-${logo.src}`"
                    class="sponsor-logo-tile"
                  >
                    <img :alt="logo.alt" :src="logo.src">
                  </div>
                </div>
              </template>
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
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.01em;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  margin-bottom: 6px;
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
}

.talk-card-compact-line {
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.sponsor-col {
  flex-shrink: 0;
  width: 21%;
  min-width: 200px;
  max-width: 320px;
  border-left: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.015);
  overflow: hidden;
  padding: 20px 16px;
}

.sponsor-track {
  display: flex;
  flex-direction: column;
}

.sponsor-track--scroll {
  animation-name: sponsor-scroll;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes sponsor-scroll {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}

.sponsor-inner {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.sponsor-group-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 0 10px;
  text-align: center;
}

.sponsor-logos {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sponsor-logo-tile {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
}

.sponsor-logo-tile img {
  max-width: 100%;
  max-height: 40px;
  object-fit: contain;
}

.sponsor-empty {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.25);
  text-align: center;
}
</style>
