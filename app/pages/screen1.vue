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

const clockDisplay = computed(() => now.value.toFormat('HH:mm:ss'))
const dateDisplay = computed(() => now.value.setLocale('de').toFormat('EEEE, d. MMMM yyyy'))

// ── Main stage ────────────────────────────────────────────────
const mainStageSlug = ref('main-stage')

const mainStageTalks = computed(() =>
  processedTalks.value.filter(t => t.stageObject?.slug === mainStageSlug.value),
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
  }
  catch {}
}

function saveSettings() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem('screen1-settings', JSON.stringify({
    mainStageSlug: mainStageSlug.value,
  }))
}

watch(mainStageSlug, saveSettings)

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
      <div class="header-right">
        <span class="clock-date">{{ dateDisplay }}</span>
        <span class="clock-time">{{ clockDisplay }}</span>
      </div>
    </header>

    <!-- ── Main grid ───────────────────────────────────────── -->
    <main class="screen-main">
      <!-- Current talk tile (top left) -->
      <div class="tile tile-current">
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

          <!-- Timers -->
          <div class="timer-block">
            <!-- Progress bar -->
            <div class="progress-bar-track">
              <div
                class="progress-bar-fill"
                :style="{ width: talkProgress + '%' }"
              />
            </div>
            <div class="timer-row">
              <div class="timer-item">
                <UIcon
                  name="i-lucide-play"
                  class="timer-icon timer-icon--elapsed"
                />
                <span class="timer-label">Läuft seit</span>
                <span class="timer-value timer-value--elapsed">{{ fmtTimer(elapsedSeconds) }}</span>
              </div>
              <div class="timer-item">
                <UIcon
                  name="i-lucide-timer"
                  class="timer-icon timer-icon--remain"
                />
                <span class="timer-label">Verbleibend</span>
                <span class="timer-value timer-value--remain">{{ fmtTimer(remainingSeconds) }}</span>
              </div>
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

        <!-- No talk running -->
        <template v-else>
          <div class="no-talk">
            <UIcon
              name="i-lucide-monitor-off"
              class="no-talk-icon"
            />
            <p class="no-talk-text">
              Aktuell kein Talk auf der Hauptbühne
            </p>
            <div
              v-if="nextTalk"
              class="no-talk-next"
            >
              Nächster Talk: <strong>{{ nextTalk.title }}</strong>
              um {{ fmtTime(nextTalk.start) }} Uhr
              <span v-if="untilNextSeconds">(in {{ fmtCountdown(untilNextSeconds) }})</span>
            </div>
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
  grid-template-rows: 64px 1fr 160px;
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

/* ── Header ─────────────────────────────────────────────────── */
.screen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.logo-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
}

.logo-btn:hover {
  background: rgba(255, 145, 77, 0.12);
}

.logo-img {
  height: 36px;
  width: auto;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.clock-time {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: #ff914d;
  line-height: 1;
}

.clock-date {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}

/* ── Main grid ──────────────────────────────────────────────── */
.screen-main {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  padding: 16px 24px;
  min-height: 0;
}

/* ── Tiles ──────────────────────────────────────────────────── */
.tile {
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.035);
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.tile-next {
  background: rgba(255, 255, 255, 0.03);
}

.tile-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

/* ── Type badge ─────────────────────────────────────────────── */
.talk-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(255, 145, 77, 0.15);
  border: 1px solid rgba(255, 145, 77, 0.3);
  color: #ff914d;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  width: fit-content;
}

.talk-type-badge--small {
  font-size: 0.6rem;
  padding: 2px 8px;
}

/* ── Current talk content ───────────────────────────────────── */
.current-title {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  font-weight: 800;
  line-height: 1.15;
  margin: 0;
  color: #fff;
}

.current-desc {
  font-size: 0.875rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Next talk content ──────────────────────────────────────── */
.next-title {
  font-size: clamp(1.1rem, 2vw, 1.6rem);
  font-weight: 700;
  line-height: 1.2;
  margin: 0;
  color: #fff;
}

.next-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

.next-time-countdown {
  color: #ff914d;
  font-weight: 600;
}

.inline-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

/* ── Speaker ────────────────────────────────────────────────── */
.speaker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: auto;
}

.speaker-row--compact {
  margin-top: 8px;
}

.speaker-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.speaker-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 145, 77, 0.35);
  flex-shrink: 0;
}

.speaker-avatar--small {
  width: 40px;
  height: 40px;
}

.speaker-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.speaker-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
}

.speaker-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ── Timers ─────────────────────────────────────────────────── */
.timer-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding-top: 4px;
}

.progress-bar-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff914d, #fe6211);
  border-radius: 99px;
  transition: width 1s linear;
}

.timer-row {
  display: flex;
  gap: 20px;
}

.timer-item {
  display: flex;
  align-items: center;
  gap: 7px;
}

.timer-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.timer-icon--elapsed {
  color: rgba(255, 255, 255, 0.3);
}

.timer-icon--remain {
  color: #ff914d;
}

.timer-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.04em;
}

.timer-value {
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
}

.timer-value--elapsed {
  color: rgba(255, 255, 255, 0.45);
}

.timer-value--remain {
  color: #ff914d;
}

.next-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.next-hint strong {
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
}

.next-hint-icon {
  color: #ff914d;
  font-size: 0.85rem;
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
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  text-align: center;
}

.no-talk--small {
  align-items: flex-start;
  text-align: left;
}

.no-talk-icon {
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.1);
}

.no-talk-text {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

.no-talk-next {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  max-width: 400px;
}

.no-talk-next strong {
  color: #fff;
}

/* ── Alt stages row ─────────────────────────────────────────── */
.stages-row {
  display: flex;
  gap: 12px;
  padding: 0 24px 16px;
  min-height: 0;
}

.stage-tile {
  flex: 1;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.025);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.stage-name {
  font-size: 0.6rem;
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
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(229, 62, 62, 0.2);
  border: 1px solid rgba(229, 62, 62, 0.35);
  color: #e53e3e;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  width: fit-content;
}

.stage-talk-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.stage-speakers {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
}

.stage-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 145, 77, 0.3);
  flex-shrink: 0;
}

.stage-speaker-name {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-next-time {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

.stage-empty {
  color: rgba(255, 255, 255, 0.15);
  font-size: 1rem;
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
