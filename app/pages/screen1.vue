<script setup lang="ts">
import { DateTime } from 'luxon'

definePageMeta({ layout: false })

// Force dark mode, restore on leave
const colorMode = useColorMode()
onMounted(() => { colorMode.value = 'dark' })
onUnmounted(() => { colorMode.preference = 'system' })

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

// ── Live clock ────────────────────────────────────────────────
const now = ref(DateTime.now().setZone(timeZone))
let clockTimer: ReturnType<typeof setInterval>
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = DateTime.now().setZone(timeZone)
  }, 1000)
})
onUnmounted(() => clearInterval(clockTimer))

const clockDisplay = computed(() => now.value.toFormat('HH:mm'))

// ── Date selection ────────────────────────────────────────────
const autoMode = ref(true)
const manualDate = ref('')

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

// ── Alternative stages ────────────────────────────────────────
const altStages = computed(() =>
  (stages.value ?? []).filter(s => s.slug !== mainStageSlug.value),
)

function getAltStageTalk(stageSlug: string) {
  const stageTalks = processedTalks.value.filter(t => t.stageObject?.slug === stageSlug)
  const current = stageTalks.find(t => t.start <= now.value && t.end > now.value)
  if (current) return { talk: current, status: 'live' as const }
  const next = stageTalks.find(t => t.start > now.value)
  if (next) return { talk: next, status: 'next' as const }
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
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return `${m} min`
}

function fmtTime(dt: DateTime): string {
  return dt.toFormat('HH:mm')
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
  }
  catch {}
}

function saveSettings() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem('screen1-settings', JSON.stringify({
    mainStageSlug: mainStageSlug.value,
    autoMode: autoMode.value,
    manualDate: manualDate.value,
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
  return DateTime.fromISO(iso).setLocale('de').toFormat('EEE, d. MMM')
}

watch([mainStageSlug, autoMode, manualDate], saveSettings)

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
  <div class="screen-root">
    <!-- ── Config overlay ───────────────────────────────────── -->
    <Transition name="fade">
      <div
        v-if="showConfig"
        class="config-panel"
        @mousemove="keepOpen"
      >
        <div class="config-inner">
          <p class="config-label">
            Einstellungen
          </p>

          <!-- Vollbild -->
          <button
            class="config-btn"
            @click="toggleFullscreen"
          >
            <UIcon
              :name="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
              class="config-btn-icon"
            />
            {{ isFullscreen ? 'Vollbild beenden' : 'Vollbild' }}
          </button>

          <!-- Datum -->
          <div class="config-section">
            <p class="config-section-label">
              Datum
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
        </div>
      </div>
    </Transition>

    <!-- ── Header bar ──────────────────────────────────────── -->
    <header class="screen-header">
      <button
        class="logo-btn"
        aria-label="Einstellungen öffnen"
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
    <main :class="['screen-main', !currentTalk && 'screen-main--pause']">
      <!-- Current talk tile (top left) -->
      <div :class="['tile tile-current', !currentTalk && 'tile-current--pause']">
        <template v-if="currentTalk">
          <!-- Type badge -->
          <div class="talk-type-badge">
            {{ fmtType(currentTalk.type) }}
          </div>

          <!-- Title -->
          <h1 class="current-title">
            {{ currentTalk.title }}
          </h1>

          <!-- Description -->
          <p
            v-if="currentTalk.description"
            class="current-desc"
          >
            {{ currentTalk.description }}
          </p>

          <!-- Speaker row -->
          <div
            v-if="currentTalk.speakerObjects.length"
            class="speaker-row"
          >
            <div
              v-for="speaker in currentTalk.speakerObjects"
              :key="speaker.slug"
              class="speaker-item"
            >
              <NuxtImg
                v-if="speaker.image"
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
          </div>

          <!-- Progress section -->
          <div class="progress-section">
            <!-- Time labels above bar -->
            <div class="progress-labels">
              <div class="progress-label-item">
                <span class="progress-label-text">Läuft seit</span>
                <span class="progress-label-value progress-label-value--elapsed">{{ fmtTimer(elapsedSeconds) }}</span>
              </div>
              <div class="progress-label-item progress-label-item--right">
                <span class="progress-label-text">Verbleibend</span>
                <span class="progress-label-value progress-label-value--remain">{{ fmtTimer(remainingSeconds) }}</span>
              </div>
            </div>

            <!-- Visual bar -->
            <div class="progress-bar-track">
              <div
                class="progress-bar-fill"
                :style="{ width: talkProgress + '%' }"
              />
              <!-- Current position marker -->
              <div
                class="progress-bar-marker"
                :style="{ left: talkProgress + '%' }"
              />
            </div>

            <!-- Time stamps below bar -->
            <div class="progress-timestamps">
              <span>{{ fmtTime(currentTalk.start) }}</span>
              <span>{{ fmtTime(currentTalk.end) }}</span>
            </div>

            <!-- Until next talk -->
            <div
              v-if="untilNextSeconds !== null"
              class="next-hint"
            >
              <UIcon
                name="i-lucide-arrow-right"
                class="next-hint-icon"
              />
              Nächster Talk in
              <strong>{{ fmtCountdown(untilNextSeconds) }}</strong>
              <span class="next-hint-time">({{ nextTalk ? fmtTime(nextTalk.start) : '' }} Uhr)</span>
            </div>
          </div>
        </template>

        <!-- Pause state -->
        <template v-else>
          <div class="pause-state">
            <span class="pause-label">Pause</span>
          </div>
        </template>
      </div>

      <!-- Next talk tile (top right) -->
      <div class="tile tile-next">
        <template v-if="nextTalk">
          <p class="tile-label">
            Nächster Talk
          </p>
          <div class="talk-type-badge talk-type-badge--small">
            {{ fmtType(nextTalk.type) }}
          </div>
          <h2 class="next-title">
            {{ nextTalk.title }}
          </h2>
          <p class="next-time">
            <UIcon
              name="i-lucide-clock"
              class="inline-icon"
            />
            {{ fmtTime(nextTalk.start) }} Uhr
            <span
              v-if="untilNextSeconds"
              class="next-time-countdown"
            >— in {{ fmtCountdown(untilNextSeconds) }}</span>
          </p>
          <div
            v-if="nextTalk.speakerObjects.length"
            class="speaker-row speaker-row--compact"
          >
            <div
              v-for="speaker in nextTalk.speakerObjects"
              :key="speaker.slug"
              class="speaker-item"
            >
              <NuxtImg
                v-if="speaker.image"
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
          </div>
        </template>
        <template v-else>
          <p class="tile-label">
            Nächster Talk
          </p>
          <div class="no-talk no-talk--small">
            <p class="no-talk-text">
              Keine weiteren Talks geplant
            </p>
          </div>
        </template>
      </div>
    </main>

    <!-- ── Alt stages row ──────────────────────────────────── -->
    <footer class="stages-row">
      <div
        v-for="stage in altStages"
        :key="stage.slug"
        class="stage-tile"
      >
        <p class="stage-name">
          {{ stage.name }}
        </p>
        <template v-if="getAltStageTalk(stage.slug)">
          <div
            v-if="getAltStageTalk(stage.slug)!.status === 'live'"
            class="stage-live-badge"
          >
            LIVE
          </div>
          <p class="stage-talk-title">
            {{ getAltStageTalk(stage.slug)!.talk.title }}
          </p>
          <div
            v-if="getAltStageTalk(stage.slug)!.talk.speakerObjects.length"
            class="stage-speakers"
          >
            <NuxtImg
              v-for="sp in getAltStageTalk(stage.slug)!.talk.speakerObjects.slice(0, 2)"
              :key="sp.slug"
              :src="sp.image"
              :alt="sp.name"
              class="stage-avatar"
            />
            <span class="stage-speaker-name">
              {{ getAltStageTalk(stage.slug)!.talk.speakerObjects.map((s: any) => s.name).join(', ') }}
            </span>
          </div>
          <p
            v-if="getAltStageTalk(stage.slug)!.status === 'next'"
            class="stage-next-time"
          >
            {{ fmtTime(getAltStageTalk(stage.slug)!.talk.start) }} Uhr
          </p>
        </template>
        <template v-else>
          <p class="stage-empty">
            —
          </p>
        </template>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ── Root ───────────────────────────────────────────────────── */
.screen-root {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: 88px 1fr 190px;
  background: #080808;
  color: #fff;
  font-family: 'Public Sans', sans-serif;
  overflow: hidden;
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

/* ── Header ─────────────────────────────────────────────────── */
.screen-header {
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

/* ── Main grid ──────────────────────────────────────────────── */
.screen-main {
  display: grid;
  grid-template-columns: 1fr 440px;
  gap: 16px;
  padding: 16px 24px;
  min-height: 0;
  transition: grid-template-columns 0.4s ease;
}

.screen-main--pause {
  grid-template-columns: 220px 1fr;
}

/* ── Tiles ──────────────────────────────────────────────────── */
.tile {
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.035);
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.tile-current {
  border-color: rgba(255, 145, 77, 0.2);
  background: linear-gradient(
    135deg,
    rgba(255, 145, 77, 0.06) 0%,
    rgba(255, 255, 255, 0.02) 60%
  );
}

.tile-current--pause {
  border-color: rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  justify-content: center;
  align-items: center;
  padding: 24px 20px;
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
}

/* ── Pause state ────────────────────────────────────────────── */
.pause-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.pause-label {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.15);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
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
  flex-wrap: wrap;
  gap: 18px;
  margin-top: auto;
}

.speaker-row--compact {
  margin-top: 12px;
}

.speaker-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.speaker-avatar {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 145, 77, 0.45);
  flex-shrink: 0;
}

.speaker-avatar--small {
  width: 100px;
  height: 100px;
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

/* ── Progress section ───────────────────────────────────────── */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.progress-label-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.progress-label-item--right {
  align-items: flex-end;
}

.progress-label-text {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.progress-label-value {
  font-size: 2rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1;
}

.progress-label-value--elapsed {
  color: rgba(255, 255, 255, 0.35);
}

.progress-label-value--remain {
  color: #ff914d;
}

.progress-bar-track {
  position: relative;
  height: 20px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 99px;
  overflow: visible;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 145, 77, 0.5), #ff914d);
  border-radius: 99px;
  transition: width 1s linear;
}

.progress-bar-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ff914d;
  border: 3px solid #080808;
  box-shadow: 0 0 12px rgba(255, 145, 77, 0.6);
  pointer-events: none;
}

.progress-timestamps {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.2);
  font-variant-numeric: tabular-nums;
  padding: 0 2px;
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
  display: flex;
  gap: 14px;
  padding: 0 24px 20px;
  min-height: 0;
}

.stage-tile {
  flex: 1;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
}

.stage-name {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-live-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(229, 62, 62, 0.2);
  border: 1px solid rgba(229, 62, 62, 0.35);
  color: #e53e3e;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  width: fit-content;
}

.stage-talk-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.stage-speakers {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}

.stage-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 145, 77, 0.3);
  flex-shrink: 0;
}

.stage-speaker-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-next-time {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

.stage-empty {
  color: rgba(255, 255, 255, 0.15);
  font-size: 1.2rem;
  margin: auto 0;
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
</style>
