<script setup lang="ts">
import { DateTime } from 'luxon'

definePageMeta({ layout: false })

// Force dark mode globally
const colorMode = useColorMode()
onMounted(() => { colorMode.value = 'dark' })

const appConfig = useAppConfig()
const timeZone = appConfig.general?.timeZone || 'UTC'
const logoPath = (appConfig.general as any)?.logo?.dark || '/printed-pd-02.png'

// ── Data ─────────────────────────────────────────────────────
const { data: stages, refresh: refreshStages } = await useAsyncData(
  'screen1-stages',
  () => queryCollection('stages').all(),
)
const { data: speakers, refresh: refreshSpeakers } = await useAsyncData(
  'screen1-speakers',
  () => queryCollection('speakers').all(),
)
const { data: rawTalks, refresh: refreshTalks } = await useAsyncData(
  'screen1-talks',
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

// ── Process talks ─────────────────────────────────────────────
const processedTalks = computed(() => {
  if (!rawTalks.value || !stages.value || !speakers.value) return []
  return rawTalks.value.map((talk) => {
    const speakerObjects = speakers.value!.filter(s => talk.speakers?.includes(s.slug))
    const stageObject = stages.value!.find(s => s.slug === talk.stage)
    const start = DateTime.fromISO(String(talk.dateTime), { zone: 'utc' }).setZone(timeZone)
    const end = start.plus({ minutes: talk.duration ?? 30 })
    return { ...talk, speakerObjects, stageObject, start, end }
  })
})

// ── Date selection (declared early — needed by applyTimeOverride) ─
const autoMode = ref(true)
const manualDate = ref('')

// ── Live clock ────────────────────────────────────────────────
// timeOverride: 'HH:mm' string — when set, clock runs forward from
// that simulated time (offset = simTime - realTimeAtActivation)
const timeOverride = ref('')
const timeOverrideOffset = ref(0) // milliseconds offset applied to real clock

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
  // Use the selected conference date as base, not today
  const dateStr = manualDate.value || nowTick.value.toISODate()!
  const simTarget = DateTime.fromISO(dateStr, { zone: timeZone }).set({ hour: h, minute: m, second: 0, millisecond: 0 })
  timeOverrideOffset.value = simTarget.diff(nowTick.value).milliseconds
  timeOverride.value = hhmm
}

// Re-apply offset when date changes while override is active
watch(manualDate, () => { if (timeOverride.value) applyTimeOverride(timeOverride.value) })

const availableDays = computed(() => {
  const days = new Set<string>()
  processedTalks.value.forEach((t) => {
    const day = t.start.toISODate()
    if (day) days.add(day)
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

// ── Main stage ────────────────────────────────────────────────
const mainStageSlug = ref('main-stage')

const mainStageTalks = computed(() =>
  processedTalks.value.filter(
    t => t.stageObject?.slug === mainStageSlug.value && t.start.toISODate() === selectedDay.value,
  ),
)

const currentTalk = computed(() =>
  mainStageTalks.value.find(t => t.start <= now.value && t.end > now.value) ?? null,
)

const nextTalk = computed(() =>
  mainStageTalks.value.find(t => t.start > now.value) ?? null,
)

// True when stage has no current or upcoming talk (all done / none scheduled today)
const mainStageEmpty = computed(() => !currentTalk.value && !nextTalk.value)

// ── Live timers for current talk ──────────────────────────────
const elapsedSeconds = computed(() => {
  if (!currentTalk.value) return 0
  return Math.max(0, Math.floor(now.value.diff(currentTalk.value.start, 'seconds').seconds))
})

const remainingSeconds = computed(() => {
  if (!currentTalk.value) return 0
  return Math.max(0, Math.floor(currentTalk.value.end.diff(now.value, 'seconds').seconds))
})

// Time until next talk starts (from now, regardless of whether something is running)
const untilNextSeconds = computed(() => {
  if (!nextTalk.value) return null
  const diff = Math.floor(nextTalk.value.start.diff(now.value, 'seconds').seconds)
  return diff > 0 ? diff : null
})

// Progress of current talk (0–100)
const talkProgress = computed(() => {
  if (!currentTalk.value) return 0
  const total = (currentTalk.value.duration ?? 30) * 60
  return Math.min(100, Math.round((elapsedSeconds.value / total) * 100))
})

// ── Font scale ────────────────────────────────────────────────
const fontScale = ref(1.0)

// ── Sponsor bar ───────────────────────────────────────────────
const showSponsorBar = ref(false)
const sponsorBarLogoUrl = ref('')

const mainStageName = computed(
  () => stages.value?.find(s => s.slug === mainStageSlug.value)?.name ?? mainStageSlug.value,
)

function onSponsorLogoUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    sponsorBarLogoUrl.value = e.target?.result as string
    saveSettings()
  }
  reader.readAsDataURL(file)
}

// ── Clipping detection (hide images when tile overflows) ──────
const currentTileRef = ref<HTMLElement | null>(null)
const nextTileRef = ref<HTMLElement | null>(null)
const hideCurrentImages = ref(false)
const hideNextImages = ref(false)
const hideAltImages = reactive<Record<string, boolean>>({})
const altObservers = new Map<string, ResizeObserver>()

function isClipped(el: HTMLElement) {
  return el.scrollHeight > el.clientHeight + 2
}

// Reset when talks change (allow re-check after content changes)
watch(currentTalk, () => { hideCurrentImages.value = false })
watch(nextTalk, () => { hideNextImages.value = false })

// Reset on zoom change so images show again if now there's space
watch(fontScale, () => {
  hideCurrentImages.value = false
  hideNextImages.value = false
  Object.keys(hideAltImages).forEach(k => { hideAltImages[k] = false })
})

watchEffect((onCleanup) => {
  const el = currentTileRef.value
  if (!el) return
  const obs = new ResizeObserver(() => {
    if (!hideCurrentImages.value && isClipped(el)) hideCurrentImages.value = true
  })
  obs.observe(el)
  onCleanup(() => obs.disconnect())
})

watchEffect((onCleanup) => {
  const el = nextTileRef.value
  if (!el) return
  const obs = new ResizeObserver(() => {
    if (!hideNextImages.value && isClipped(el)) hideNextImages.value = true
  })
  obs.observe(el)
  onCleanup(() => obs.disconnect())
})

function setAltRef(el: HTMLElement | null, slug: string) {
  if (!el) {
    altObservers.get(slug)?.disconnect()
    altObservers.delete(slug)
    return
  }
  altObservers.get(slug)?.disconnect()
  const obs = new ResizeObserver(() => {
    if (!hideAltImages[slug] && isClipped(el)) hideAltImages[slug] = true
  })
  altObservers.set(slug, obs)
  obs.observe(el)
}

onUnmounted(() => {
  altObservers.forEach(obs => obs.disconnect())
})

// ── QR Code ───────────────────────────────────────────────────
const qrUrl = ref('/Hub26_scheduleqr_white_scaled.png')

// ── Alternative stages ────────────────────────────────────────
const hiddenAltSlugs = ref<Set<string>>(new Set())

const altStages = computed(() =>
  (stages.value ?? []).filter(s => s.slug !== mainStageSlug.value),
)

const visibleAltStages = computed(() =>
  altStages.value.filter(s => !hiddenAltSlugs.value.has(s.slug)),
)

function toggleAltStage(slug: string) {
  if (hiddenAltSlugs.value.has(slug)) hiddenAltSlugs.value.delete(slug)
  else hiddenAltSlugs.value.add(slug)
  saveSettings()
  scheduleHide()
}

function getAltStageTalk(stageSlug: string) {
  const stageTalks = processedTalks.value.filter(
    t => t.stageObject?.slug === stageSlug && t.start.toISODate() === selectedDay.value,
  )
  const current = stageTalks.find(t => t.start <= now.value && t.end > now.value)
  if (current) return { talk: current, status: 'live' as const, untilSeconds: null as number | null }
  const next = stageTalks.find(t => t.start > now.value)
  if (next) {
    const diff = Math.floor(next.start.diff(now.value, 'seconds').seconds)
    return { talk: next, status: 'next' as const, untilSeconds: diff > 0 ? diff : null }
  }
  return null
}

// ── Format helpers ────────────────────────────────────────────
function fmtTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtTime(dt: DateTime): string {
  return dt.toFormat('HH:mm')
}

function fmtCountdownHM(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m`
}

function fmtType(type: string): string {
  const map: Record<string, string> = {
    'talk': 'Talk',
    'lightning-talk': 'Lightning Talk',
    'panel': 'Panel',
    'keynote': 'Keynote',
    'workshop': 'Workshop',
    'other': '',
  }
  return map[type] ?? type
}

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
  hideConfigTimer = setTimeout(() => { showConfig.value = false }, 5000)
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

// ── sessionStorage persistence ────────────────────────────────
function loadSettings() {
  if (typeof sessionStorage === 'undefined') return
  try {
    const raw = sessionStorage.getItem('screen1-settings')
    if (!raw) return
    const p = JSON.parse(raw)
    if (p.mainStageSlug) mainStageSlug.value = p.mainStageSlug
    if (typeof p.autoMode === 'boolean') autoMode.value = p.autoMode
    if (p.manualDate) manualDate.value = p.manualDate
    if (p.timeOverride) applyTimeOverride(p.timeOverride)
    if (Array.isArray(p.hiddenAltSlugs)) hiddenAltSlugs.value = new Set(p.hiddenAltSlugs)
    if (p.qrUrl) qrUrl.value = p.qrUrl
    if (typeof p.fontScale === 'number') fontScale.value = p.fontScale
    if (typeof p.showSponsorBar === 'boolean') showSponsorBar.value = p.showSponsorBar
    if (p.sponsorBarLogoUrl) sponsorBarLogoUrl.value = p.sponsorBarLogoUrl
  }
  catch {}
}

function saveSettings() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem('screen1-settings', JSON.stringify({
    mainStageSlug: mainStageSlug.value,
    autoMode: autoMode.value,
    manualDate: manualDate.value,
    timeOverride: timeOverride.value,
    hiddenAltSlugs: [...hiddenAltSlugs.value],
    qrUrl: qrUrl.value,
    fontScale: fontScale.value,
    showSponsorBar: showSponsorBar.value,
    sponsorBarLogoUrl: sponsorBarLogoUrl.value,
  }))
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

function fmtDayLabel(iso: string): string {
  return DateTime.fromISO(iso).setLocale('en').toFormat('EEE, d. MMM')
}

watch([mainStageSlug, autoMode, manualDate, fontScale, showSponsorBar], saveSettings)

onMounted(() => {
  loadSettings()
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

onUnmounted(() => {
  clearTimeout(hideConfigTimer)
})
</script>

<template>
  <div class="screen-outer">
    <!-- ── Config overlay (outside zoom) ─────────────────────── -->
    <Transition name="fade">
      <div
        v-if="showConfig"
        class="config-panel"
        @mousemove="keepOpen"
        @click.self="showConfig = false"
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
              :name="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
              class="config-btn-icon"
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
                :class="['config-date-btn', autoMode && 'config-date-btn--active']"
                @click="setAutoMode"
              >
                Auto
              </button>
              <button
                v-for="day in availableDays"
                :key="day"
                :class="['config-date-btn', !autoMode && selectedDay === day && 'config-date-btn--active']"
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
                :value="timeOverride"
                type="time"
                class="config-time-input"
                :class="isTimeOverride && 'config-time-input--active'"
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

          <!-- Main stage -->
          <div class="config-section">
            <p class="config-section-label">
              Main stage (top)
            </p>
            <div class="config-date-row">
              <button
                v-for="stage in stages"
                :key="stage.slug"
                :class="['config-date-btn', mainStageSlug === stage.slug && 'config-date-btn--active']"
                @click="mainStageSlug = stage.slug; saveSettings(); scheduleHide()"
              >
                {{ stage.name }}
              </button>
            </div>
          </div>

          <!-- Side stages -->
          <div class="config-section">
            <p class="config-section-label">
              Show stages below
            </p>
            <div class="config-date-row">
              <button
                v-for="stage in altStages"
                :key="stage.slug"
                :class="['config-date-btn', !hiddenAltSlugs.has(stage.slug) && 'config-date-btn--active']"
                @click="toggleAltStage(stage.slug)"
              >
                {{ stage.name }}
              </button>
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
                type="range"
                min="0.8"
                max="1.35"
                step="0.05"
                class="config-font-slider"
                @click.stop
              >
              <span class="config-font-a config-font-a--lg">A</span>
              <button
                v-if="fontScale !== 1"
                class="config-date-btn"
                @click="fontScale = 1; saveSettings(); scheduleHide()"
              >
                Reset
              </button>
            </div>
          </div>

          <!-- QR Code URL -->
          <div class="config-section">
            <p class="config-section-label">
              QR Code URL
            </p>
            <div class="config-time-row">
              <input
                v-model="qrUrl"
                type="url"
                placeholder="https://..."
                class="config-time-input config-url-input"
                @click.stop
                @change="saveSettings()"
              >
              <button
                v-if="qrUrl"
                class="config-date-btn"
                @click="qrUrl = ''; saveSettings()"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Sponsor Bar -->
          <div class="config-section">
            <p class="config-section-label">
              Sponsor Bar
            </p>
            <button
              :class="['config-btn', showSponsorBar && 'config-btn--active']"
              @click="showSponsorBar = !showSponsorBar; saveSettings(); scheduleHide()"
            >
              <UIcon
                :name="showSponsorBar ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                class="config-btn-icon"
              />
              {{ showSponsorBar ? 'Eingeblendet' : 'Ausgeblendet' }}
            </button>
            <div class="config-time-row" style="margin-top: 8px">
              <label class="config-upload-btn" @click.stop>
                <UIcon name="i-lucide-image" class="config-btn-icon" />
                Logo hochladen
                <input
                  type="file"
                  accept="image/*"
                  style="display:none"
                  @change="onSponsorLogoUpload"
                  @click.stop
                >
              </label>
              <button
                v-if="sponsorBarLogoUrl"
                class="config-date-btn"
                @click="sponsorBarLogoUrl = ''; saveSettings()"
              >
                Clear
              </button>
            </div>
            <img
              v-if="sponsorBarLogoUrl"
              :src="sponsorBarLogoUrl"
              alt="Sponsor logo preview"
              class="config-logo-preview"
            >
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Scaled content root ───────────────────────────────── -->
    <div :class="['screen-root', mainStageEmpty && 'screen-root--empty']" :style="{ '--font-scale': fontScale }">

    <!-- ── Header bar ──────────────────────────────────────── -->
    <header class="screen-header">
      <button
        class="logo-btn"
        aria-label="Open settings"
        @click="openConfig"
      >
        <NuxtImg
          :src="logoPath"
          alt="PRINTED"
          class="logo-img"
        />
      </button>
      <span class="clock-time">{{ clockDisplay }}</span>
    </header>

    <!-- ── Main grid ───────────────────────────────────────── -->
    <main
      v-if="mainStageEmpty"
      class="screen-main-empty"
    >
      <p class="stage-empty-msg">
        This stage is empty for today
      </p>
    </main>
    <main
      v-else
      class="screen-main"
      :style="!(currentTalk && nextTalk) ? { gridTemplateColumns: '1fr' } : {}"
    >
      <!-- Current talk tile — only when a talk is live -->
      <div
        v-if="currentTalk"
        ref="currentTileRef"
        class="tile tile-current"
      >
        <!-- Label: Now Live -->
        <p class="tile-label tile-label--live">
          <span class="live-dot" />
          Now Live
        </p>

        <!-- Title -->
        <h1 class="current-title">
          {{ currentTalk.title }}
        </h1>

        <!-- Type badge -->
        <div class="talk-type-badge">
          {{ fmtType(currentTalk.type) }}
        </div>

        <!-- Time row -->
        <p class="current-time-row">
          <UIcon name="i-lucide-clock" class="inline-icon" />
          {{ fmtTime(currentTalk.start) }}
          <span class="current-time-sep">–</span>
          {{ fmtTime(currentTalk.end) }}
        </p>

        <!-- Body content -->
        <div
          v-if="currentTalk.body"
          class="current-desc"
        >
          <ContentRenderer :value="currentTalk" />
        </div>

        <!-- Speaker row -->
        <div
          v-if="currentTalk.speakerObjects.length"
          class="speaker-row"
        >
          <div
            v-for="speaker in currentTalk.speakerObjects.slice(0, 4)"
            :key="speaker.slug"
            class="speaker-item"
          >
            <NuxtImg
              v-if="speaker.image && !hideCurrentImages"
              :src="speaker.image"
              :alt="speaker.name"
              class="speaker-avatar"
            />
            <div class="speaker-info">
              <span class="speaker-name">{{ speaker.name }}</span>
              <span
                v-if="speaker.description"
                class="speaker-desc"
              >{{ speaker.description }}</span>
            </div>
          </div>
          <span
            v-if="currentTalk.speakerObjects.length > 4"
            class="speaker-more"
          >und {{ currentTalk.speakerObjects.length - 4 }} weitere...</span>
        </div>

        <!-- Progress bar pinned to bottom -->
        <div class="progress-footer">
          <div class="progress-footer-labels">
            <span class="progress-footer-elapsed">{{ fmtTimer(elapsedSeconds) }}</span>
            <span class="progress-footer-remain">{{ fmtTimer(remainingSeconds) }}</span>
          </div>
          <div class="progress-footer-track">
            <div
              class="progress-footer-fill"
              :style="{ width: talkProgress + '%' }"
            />
          </div>
        </div>
      </div>

      <!-- Next talk tile — only when a next talk exists -->
      <div
        v-if="nextTalk"
        ref="nextTileRef"
        class="tile tile-next"
      >
        <p class="tile-label">
          Next
        </p>
        <h2 class="next-title">
          {{ nextTalk.title }}
        </h2>
        <div class="talk-type-badge talk-type-badge--small">
          {{ fmtType(nextTalk.type) }}
        </div>
        <p class="next-time">
          <UIcon
            name="i-lucide-clock"
            class="inline-icon"
          />
          {{ fmtTime(nextTalk.start) }}
          <span class="current-time-sep">–</span>
          {{ fmtTime(nextTalk.end) }}
          <span
            v-if="untilNextSeconds"
            class="next-time-countdown"
          >· in {{ fmtCountdown(untilNextSeconds) }}</span>
        </p>
        <div
          v-if="nextTalk.speakerObjects.length"
          class="speaker-row speaker-row--compact"
        >
          <div
            v-for="speaker in nextTalk.speakerObjects.slice(0, 3)"
            :key="speaker.slug"
            class="speaker-item"
          >
            <NuxtImg
              v-if="speaker.image && !hideNextImages"
              :src="speaker.image"
              :alt="speaker.name"
              class="speaker-avatar speaker-avatar--small"
            />
            <div class="speaker-info">
              <span class="speaker-name">{{ speaker.name }}</span>
              <span
                v-if="speaker.company"
                class="speaker-desc"
              >{{ speaker.company }}</span>
            </div>
          </div>
          <span
            v-if="nextTalk.speakerObjects.length > 3"
            class="speaker-more"
          >und {{ nextTalk.speakerObjects.length - 3 }} weitere...</span>
        </div>
      </div>
    </main>

    <!-- ── Alt stages row ──────────────────────────────────── -->
    <footer class="stages-row">
      <!-- Stage tiles -->
      <div
        v-for="stage in visibleAltStages"
        :key="stage.slug"
        class="stage-tile"
        :ref="(el) => setAltRef(el as HTMLElement | null, stage.slug)"
      >
        <!-- Stage name always top -->
        <p class="stage-name">
          {{ stage.name }}
        </p>

        <!-- Status row (type badge + Now Live / time + next-in) — always present, empty when no talk -->
        <div class="stage-status-row">
          <template v-if="getAltStageTalk(stage.slug)">
            <span
              class="stage-type-badge"
              :style="{ visibility: fmtType((getAltStageTalk(stage.slug) as any).talk.type) ? 'visible' : 'hidden' }"
            >{{ fmtType((getAltStageTalk(stage.slug) as any).talk.type) || '&nbsp;' }}</span>
            <div class="stage-time-status">
              <p
                v-if="(getAltStageTalk(stage.slug) as any).status === 'live'"
                class="stage-now-live"
              >
                <span class="live-dot" />
                Now Live
              </p>
              <span class="stage-time">
                {{ fmtTime((getAltStageTalk(stage.slug) as any).talk.start) }}–{{ fmtTime((getAltStageTalk(stage.slug) as any).talk.end) }}
              </span>
              <span
                v-if="(getAltStageTalk(stage.slug) as any).status === 'next' && (getAltStageTalk(stage.slug) as any).untilSeconds !== null"
                class="stage-next-in"
              >next in {{ fmtCountdownHM((getAltStageTalk(stage.slug) as any).untilSeconds) }}</span>
            </div>
          </template>
          <!-- Invisible placeholder keeps height when no talk -->
          <template v-else>
            <span class="stage-type-badge" style="visibility: hidden">
              &nbsp;
            </span>
            <div class="stage-time-status" />
          </template>
        </div>

        <!-- Title — always present, empty when no talk -->
        <p
          v-if="getAltStageTalk(stage.slug)"
          class="stage-talk-title"
        >
          {{ (getAltStageTalk(stage.slug) as any).talk.title }}
        </p>
        <p
          v-else
          class="stage-empty-today"
        >
          This stage is empty for today
        </p>

        <!-- Speakers — always present, empty when no talk -->
        <!-- Images hidden when tile overflows (clipping detection) -->
        <div class="stage-speakers">
          <template v-if="getAltStageTalk(stage.slug) && (getAltStageTalk(stage.slug) as any).talk.speakerObjects.length">
            <div
              v-for="sp in (getAltStageTalk(stage.slug) as any).talk.speakerObjects.slice(0, 3)"
              :key="sp.slug"
              class="stage-speaker-item"
            >
              <NuxtImg
                v-if="sp.image && !hideAltImages[stage.slug]"
                :src="sp.image"
                :alt="sp.name"
                class="stage-avatar"
              />
              <span class="stage-speaker-name">{{ sp.name }}</span>
            </div>
            <span
              v-if="(getAltStageTalk(stage.slug) as any).talk.speakerObjects.length > 3"
              class="stage-speaker-more"
            >und {{ (getAltStageTalk(stage.slug) as any).talk.speakerObjects.length - 3 }} weitere</span>
          </template>
        </div>
      </div>

      <!-- QR code tile (always last) -->
      <div class="stage-tile qr-tile">
        <p class="qr-schedule-label">
          View full Schedule
        </p>
        <NuxtImg
          v-if="qrUrl"
          :src="qrUrl"
          alt="QR Code"
          class="qr-img"
        />
        <div
          v-else
          class="qr-placeholder"
        >
          <UIcon
            name="i-lucide-qr-code"
            class="qr-placeholder-icon"
          />
          <span class="qr-placeholder-text">QR Code</span>
        </div>
      </div>
    </footer>
    <!-- ── Sponsor Bar overlay ──────────────────────────────── -->
    <Transition name="fade">
      <div
        v-if="showSponsorBar"
        class="sponsor-bar"
      >
        <div class="sponsor-bar-left">
          <span class="sponsor-bar-stage">{{ mainStageName }}</span>
          <span class="sponsor-bar-label">Sponsor bei:</span>
        </div>
        <div class="sponsor-bar-right">
          <img
            v-if="sponsorBarLogoUrl"
            :src="sponsorBarLogoUrl"
            alt="Sponsor"
            class="sponsor-bar-logo"
          >
          <div
            v-else
            class="sponsor-bar-logo-placeholder"
          >
            <UIcon name="i-lucide-image" style="font-size:2.5rem; opacity:0.3" />
          </div>
        </div>
      </div>
    </Transition>

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

/* ── Config overlay ─────────────────────────────────────────── */
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
  min-width: 220px;
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
  transition: background 0.15s, color 0.15s;
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

/* ── Header ─────────────────────────────────────────────────── */
.screen-header {
  flex-shrink: 0;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
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
  height: 48px;
  width: auto;
}

.clock-time {
  font-family: 'Inter', 'Public Sans', sans-serif;
  font-size: 3.2rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: #ff914d;
  line-height: 1;
}

/* ── Empty main stage ───────────────────────────────────────── */
.screen-main-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.stage-empty-msg {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.15);
}

/* ── Main grid ──────────────────────────────────────────────── */
.screen-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 440px;
  gap: 16px;
  padding: 16px 24px;
  min-height: 0;
  transition: grid-template-columns 0.4s ease;
}

/* ── Tiles ──────────────────────────────────────────────────── */
.tile {
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.035);
  padding: 32px 36px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.tile-next {
  padding-bottom: 32px;
}

.tile-current {
  border-color: rgba(255, 145, 77, 0.2);
  background: linear-gradient(
    135deg,
    rgba(255, 145, 77, 0.06) 0%,
    rgba(255, 255, 255, 0.02) 60%
  );
}


.tile-next {
  background: rgba(255, 255, 255, 0.03);
}

.tile-label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tile-label--live {
  color: #e53e3e;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53e3e;
  flex-shrink: 0;
  animation: pulse 1.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.current-time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
}

.current-time-sep {
  color: rgba(255, 255, 255, 0.2);
}

.next-hint-inline {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
  font-size: 0.95rem;
}

/* ── Type badge ─────────────────────────────────────────────── */
.talk-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 14px;
  border-radius: 20px;
  background: rgba(255, 145, 77, 0.15);
  border: 1px solid rgba(255, 145, 77, 0.3);
  color: #ff914d;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  width: fit-content;
}

.talk-type-badge--small {
  font-size: 0.7rem;
  padding: 3px 12px;
}

/* ── Current talk content ───────────────────────────────────── */
.current-title {
  font-size: clamp(2rem, 3.5vw, 3.2rem);
  font-weight: 800;
  line-height: 1.1;
  margin: 0;
  color: #fff;
}

.current-desc {
  font-size: 1.05rem;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Override ContentRenderer/Prose styles for dark screen */
.current-desc :deep(p) {
  margin: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.05rem;
  line-height: 1.65;
}

.current-desc :deep(p + p) {
  margin-top: 0.75em;
}

.current-desc :deep(h1),
.current-desc :deep(h2),
.current-desc :deep(h3) {
  display: none;
}

.current-desc :deep(strong) {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 700;
}

.current-desc :deep(a) {
  color: #ff914d;
  text-decoration: none;
}

.current-desc :deep(ul),
.current-desc :deep(ol) {
  padding-left: 1.2em;
  color: rgba(255, 255, 255, 0.5);
}

/* ── Next talk content ──────────────────────────────────────── */
.next-title {
  font-size: clamp(1.6rem, 2.8vw, 2.8rem);
  font-weight: 800;
  line-height: 1.15;
  margin: 0;
  color: #fff;
}

.next-time {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

.next-time-countdown {
  color: #ff914d;
  font-weight: 700;
}

.inline-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

/* ── Speaker ────────────────────────────────────────────────── */
.speaker-row {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.speaker-row--compact {
  margin-top: 12px;
  gap: 10px;
}

.speaker-more {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
  margin-top: 2px;
}

.speaker-item {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.speaker-avatar {
  width: 130px;
  height: 130px;
  border-radius: 18px;
  object-fit: cover;
  border: 2px solid rgba(255, 145, 77, 0.35);
  flex-shrink: 0;
}

.speaker-avatar--small {
  width: 100px;
  height: 100px;
  border-radius: 14px;
}

.speaker-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.speaker-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
}

.speaker-desc {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ── Progress footer (pinned to bottom of current tile) ─────── */
.progress-footer {
  margin-top: auto;
  flex-shrink: 0;
  padding-bottom: 20px;
}

.progress-footer-labels {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 4px 8px;
}

.progress-footer-elapsed {
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.02em;
  line-height: 1;
}

.progress-footer-remain {
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #ff914d;
  letter-spacing: 0.02em;
  line-height: 1;
}

.progress-footer-track {
  position: relative;
  height: 28px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  overflow: hidden;
}

.progress-footer-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 145, 77, 0.3), rgba(255, 145, 77, 0.85));
  border-radius: 14px 0 0 14px;
  transition: width 1s linear;
  position: relative;
}

.progress-footer-fill::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #ff914d;
  box-shadow: 0 0 14px rgba(255, 145, 77, 0.9);
}

.next-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.4);
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  margin-top: 4px;
}

.next-hint strong {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 700;
}

.next-hint-icon {
  color: #ff914d;
  font-size: 1rem;
  flex-shrink: 0;
}

.next-hint-time {
  color: rgba(255, 255, 255, 0.25);
  margin-left: 2px;
}

/* ── No talk states ─────────────────────────────────────────── */
.no-talk {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  flex: 1;
}

.no-talk-text {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

/* ── Alt stages row ─────────────────────────────────────────── */
.stages-row {
  flex-shrink: 0;
  height: 360px;
  display: flex;
  gap: 14px;
  padding: 0 24px 20px;
  align-items: stretch;
}

.stage-tile {
  flex: 1;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

.stage-name {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-now-live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #e53e3e;
  margin: 0;
}

.stage-talk-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.stage-status-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stage-type-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 145, 77, 0.12);
  border: 1px solid rgba(255, 145, 77, 0.25);
  color: #ff914d;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  width: fit-content;
}

.stage-time-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stage-time {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.45);
  font-variant-numeric: tabular-nums;
}

.stage-next-in {
  font-size: 0.8rem;
  color: rgba(255, 145, 77, 0.85);
  font-weight: 600;
}

.stage-speakers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  min-height: 0;
}

.stage-speaker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stage-avatar {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid rgba(255, 145, 77, 0.35);
  flex-shrink: 0;
}

.stage-speaker-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-speaker-more {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}

.stage-empty-today {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.15);
  margin: auto 0;
}

/* ── Font size slider ───────────────────────────────────────── */
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

/* ── QR tile ────────────────────────────────────────────────── */
.qr-tile {
  flex: 0 0 auto;
  width: 220px;
  align-items: center;
  justify-content: center;
}

.qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  opacity: 0.2;
}

.qr-placeholder-icon {
  font-size: 3rem;
}

.qr-placeholder-text {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── QR schedule label ──────────────────────────────────────── */
.qr-schedule-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
  text-align: center;
}

/* ── Config URL input ───────────────────────────────────────── */
.config-url-input {
  flex: 1;
  font-size: 0.8rem;
  font-weight: 400;
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

/* ── Sponsor Bar ─────────────────────────────────────────────── */
.sponsor-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 360px;
  height: 160px;
  z-index: 20;
  background: rgba(8, 8, 8, 0.93);
  border-top: 3px solid rgba(255, 145, 77, 0.55);
  border-bottom: 3px solid rgba(255, 145, 77, 0.55);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  padding: 0 48px;
  gap: 40px;
}

.sponsor-bar-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.sponsor-bar-stage {
  font-size: clamp(2.8rem, 5vw, 5rem);
  font-weight: 900;
  line-height: 1;
  color: #fff;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sponsor-bar-label {
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
}

.sponsor-bar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 320px;
  height: 120px;
}

.sponsor-bar-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sponsor-bar-logo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(255, 255, 255, 0.12);
  border-radius: 12px;
}

/* ── Config upload button ────────────────────────────────────── */
.config-btn--active {
  background: rgba(255, 145, 77, 0.15);
  border-color: rgba(255, 145, 77, 0.4);
  color: #ff914d;
}

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
  transition: background 0.15s, color 0.15s;
}

.config-upload-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.config-logo-preview {
  margin-top: 8px;
  max-width: 100%;
  max-height: 60px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
