<script setup lang="ts">
import { DateTime } from 'luxon'

definePageMeta({ layout: false })

const colorMode = useColorMode()
onMounted(() => { colorMode.value = 'dark' })
onUnmounted(() => { colorMode.preference = 'system' })

const appConfig = useAppConfig()
const timeZone = appConfig.general?.timeZone || 'UTC'

// ── Data ────────────────────────────────────────────────────
const { data: stages } = await useAsyncData('kiosk-stages', () => queryCollection('stages').all())
const { data: speakers } = await useAsyncData('kiosk-speakers', () => queryCollection('speakers').all())
const { data: rawTalks } = await useAsyncData('kiosk-talks', () =>
  queryCollection('talks').order('dateTime', 'ASC').all())

const processedTalks = computed(() => {
  if (!rawTalks.value || !stages.value || !speakers.value) return []
  return rawTalks.value.map((talk) => {
    const speakerHits = speakers.value!.filter(s => talk.speakers?.includes(s.slug))
    const stageHit = stages.value!.find(s => s.slug === talk.stage)
    const start = DateTime.fromISO(talk.dateTime, { zone: 'utc' }).setZone(timeZone)
    const end = start.plus({ minutes: talk.duration })
    return { ...talk, speakers: speakerHits, stage: stageHit, start, end }
  })
})

const availableDays = computed(() => {
  const days = new Set<string>()
  processedTalks.value.forEach((t) => {
    const day = t.start.toISODate()
    if (day) days.add(day)
  })
  return Array.from(days).sort()
})

// ── Date selection ───────────────────────────────────────────
const autoMode = ref(true)
const manualDate = ref(availableDays.value[0] ?? '')

const selectedDay = computed(() => {
  if (autoMode.value) {
    const today = DateTime.now().setZone(timeZone).toISODate() ?? ''
    return availableDays.value.includes(today) ? today : (availableDays.value[0] ?? today)
  }
  return manualDate.value
})

const activeTalks = computed(() => processedTalks.value.filter(t => t.start.toISODate() === selectedDay.value))

// ── Grid geometry ────────────────────────────────────────────
const HEADER_H = 56  // stage header row height
const HOUR_H = 150   // pixels per hour
const PAGE_HEADER_H = 64 // kiosk top bar height

const timeRange = computed(() => {
  if (activeTalks.value.length === 0) return { start: 9, end: 18 }
  let minH = 24; let maxH = 0
  activeTalks.value.forEach((t) => {
    const s = t.start.hour
    let e = t.end.hour
    if (t.end.minute > 0) e += 1
    if (s < minH) minH = s
    if (e > maxH) maxH = e
  })
  return { start: Math.max(0, minH - 1), end: Math.min(26, maxH + 1) }
})

const timeSlots = computed(() => {
  const slots: number[] = []
  for (let i = timeRange.value.start; i < timeRange.value.end; i++) slots.push(i)
  return slots
})

function getTalkStyle(talk: any) {
  const startMin = (talk.start.hour - timeRange.value.start) * 60 + talk.start.minute
  const top = (startMin / 60) * HOUR_H
  const height = Math.max((talk.duration / 60) * HOUR_H, 28)
  return { top: `${top}px`, height: `${height}px` }
}

function getTalksForStage(slug: string) {
  return activeTalks.value.filter(t => t.stage?.slug === slug)
}

function formatHour(h: number) {
  return `${String(h % 24).padStart(2, '0')}:00`
}

// ── Live clock ───────────────────────────────────────────────
const now = ref(DateTime.now().setZone(timeZone))
let clockTimer: ReturnType<typeof setInterval>

// Position in the scroll content where current time sits
const timeLineTop = computed(() => {
  if (now.value.toISODate() !== selectedDay.value) return null
  const minutesFromStart = (now.value.hour - timeRange.value.start) * 60 + now.value.minute
  const totalMinutes = (timeRange.value.end - timeRange.value.start) * 60
  if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null
  return HEADER_H + (minutesFromStart / 60) * HOUR_H
})

// ── Scroll: keep current time fixed at viewport center ───────
const scrollEl = ref<HTMLElement | null>(null)

function centerScroll(smooth = false) {
  if (!scrollEl.value || timeLineTop.value === null) return
  const target = timeLineTop.value - scrollEl.value.clientHeight / 2
  scrollEl.value.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'instant' })
}

onMounted(() => {
  now.value = DateTime.now().setZone(timeZone)
  nextTick(() => centerScroll(false))
  clockTimer = setInterval(() => {
    now.value = DateTime.now().setZone(timeZone)
    centerScroll(true)
  }, 1000)
})
onUnmounted(() => clearInterval(clockTimer))

const clockDisplay = computed(() => now.value.toFormat('HH:mm:ss'))

// ── Fullscreen ───────────────────────────────────────────────
const isFullscreen = ref(false)

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

// ── Talk type styles ─────────────────────────────────────────
function talkStyle(type: string) {
  switch (type?.toLowerCase()) {
    case 'keynote':  return { bg: 'rgba(255,145,77,0.14)', border: 'rgba(255,145,77,0.45)', accent: '#ff914d' }
    case 'workshop': return { bg: 'rgba(63,185,80,0.11)',  border: 'rgba(63,185,80,0.38)',  accent: '#3fb950' }
    case 'panel':    return { bg: 'rgba(88,166,255,0.11)', border: 'rgba(88,166,255,0.38)', accent: '#58a6ff' }
    default:         return { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', accent: '#888' }
  }
}

function typeLabel(type: string) {
  return (type || '').split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
</script>

<template>
  <div class="kiosk-root">

    <!-- ── Header ─────────────────────────────────────────── -->
    <header class="kiosk-header">
      <div class="header-logo">
        <img src="/printed-pd-02.png" alt="PRINTED Europe" class="logo-img">
      </div>

      <div class="date-controls">
        <button class="ctrl-btn" :class="{ active: autoMode }" @click="autoMode = true">
          Auto
        </button>
        <span class="ctrl-sep" />
        <button class="ctrl-btn" :class="{ active: !autoMode }" @click="autoMode = false">
          Datum wählen
        </button>
        <select v-if="!autoMode" v-model="manualDate" class="date-select">
          <option v-for="day in availableDays" :key="day" :value="day">
            {{ DateTime.fromISO(day).setLocale('de').toFormat('EEE, dd. MMM yyyy') }}
          </option>
        </select>
        <span v-else class="date-label">
          {{ selectedDay ? DateTime.fromISO(selectedDay).setLocale('de').toFormat('EEEE, dd. MMMM yyyy') : '—' }}
        </span>
      </div>

      <div class="header-right">
        <div class="kiosk-clock">{{ clockDisplay }}</div>
        <button class="fullscreen-btn" :title="isFullscreen ? 'Vollbild beenden' : 'Vollbild'" @click="toggleFullscreen">
          <!-- Maximize icon -->
          <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
          <!-- Minimize icon -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
            <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- ── Fixed center line (always at viewport middle) ─── -->
    <div v-if="timeLineTop !== null" class="fixed-timeline">
      <div class="fixed-now-badge">JETZT</div>
    </div>

    <!-- ── Schedule ───────────────────────────────────────── -->
    <div
      v-if="stages && stages.length && activeTalks.length"
      ref="scrollEl"
      class="schedule-scroll"
    >
      <div class="schedule-inner">

        <!-- Time axis -->
        <div class="time-axis">
          <div class="time-axis-header" :style="{ height: `${HEADER_H}px` }" />

          <!-- "now" marker on time axis (scrolls with content, stays aligned with fixed line) -->
          <div
            v-if="timeLineTop !== null"
            class="now-axis-dot"
            :style="{ top: `${timeLineTop}px` }"
          />

          <div
            v-for="h in timeSlots"
            :key="h"
            class="time-cell"
            :style="{ height: `${HOUR_H}px` }"
          >
            <span class="time-label">{{ formatHour(h) }}</span>
          </div>
        </div>

        <!-- Stages -->
        <div class="stages-area">
          <div
            v-for="stage in stages"
            :key="stage.slug"
            class="stage-col"
          >
            <div class="stage-header" :style="{ height: `${HEADER_H}px` }">
              {{ stage.name }}
            </div>
            <div class="stage-body">
              <div
                v-for="h in timeSlots"
                :key="`g-${h}`"
                class="grid-line"
                :style="{ height: `${HOUR_H}px` }"
              />
              <div
                v-for="talk in getTalksForStage(stage.slug)"
                :key="talk.slug"
                class="talk-card"
                :style="{
                  ...getTalkStyle(talk),
                  background: talkStyle(talk.type).bg,
                  borderColor: talkStyle(talk.type).border,
                }"
              >
                <div class="talk-type" :style="{ color: talkStyle(talk.type).accent }">
                  {{ typeLabel(talk.type) }}
                </div>
                <div class="talk-title">{{ talk.title }}</div>
                <div class="talk-time">
                  {{ talk.start.toFormat('HH:mm') }} · {{ talk.duration }} min
                </div>
                <div v-if="talk.speakers?.length" class="talk-speakers">
                  <div v-for="sp in talk.speakers" :key="sp.slug" class="talk-speaker">
                    <NuxtImg
                      v-if="sp.image"
                      :src="sp.image"
                      :alt="sp.name"
                      width="28"
                      height="28"
                      class="speaker-img"
                    />
                    <span class="speaker-name">{{ sp.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div v-else class="empty-state">
      <p>Keine Talks für diesen Tag geplant.</p>
    </div>

  </div>
</template>

<style scoped>
.kiosk-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #0a0a0a;
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

/* ── Header ── */
.kiosk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: v-bind('PAGE_HEADER_H + "px"');
  flex-shrink: 0;
  background: #111;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  gap: 20px;
  z-index: 200;
  position: relative;
}

.header-logo { display: flex; align-items: center; flex-shrink: 0; }
.logo-img { height: 34px; width: auto; object-fit: contain; }

.date-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  justify-content: center;
}

.ctrl-btn {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.14);
  background: transparent;
  color: #777;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.ctrl-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
.ctrl-btn.active { background: rgba(255,145,77,0.16); border-color: #ff914d; color: #ff914d; }

.ctrl-sep { width: 1px; height: 16px; background: rgba(255,255,255,0.1); }

.date-select {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  padding: 5px 10px;
  font-family: inherit;
  outline: none;
}

.date-label { font-size: 14px; color: #999; font-weight: 500; }

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.kiosk-clock {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  color: #ff914d;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.fullscreen-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: all 0.15s;
}
.fullscreen-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

/* ── Fixed center timeline ── */
.fixed-timeline {
  position: fixed;
  left: 0;
  right: 0;
  /* Center of the schedule area (below the 64px header) */
  top: calc(v-bind('PAGE_HEADER_H + "px"') + (100dvh - v-bind('PAGE_HEADER_H + "px"')) / 2);
  z-index: 100;
  pointer-events: none;
  border-top: 2px solid #e53e3e;
  box-shadow: 0 0 16px rgba(229,62,62,0.5), 0 0 40px rgba(229,62,62,0.15);
}

.fixed-now-badge {
  position: absolute;
  left: 6px;
  top: -10px;
  background: #e53e3e;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.08em;
  pointer-events: none;
}

/* ── Schedule scroll ── */
.schedule-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  scrollbar-width: none; /* hide scrollbar for kiosk */
}
.schedule-scroll::-webkit-scrollbar { display: none; }

.schedule-inner {
  display: flex;
  min-width: 100%;
}

/* ── Time axis ── */
.time-axis {
  position: sticky;
  left: 0;
  z-index: 30;
  width: 68px;
  flex-shrink: 0;
  background: #0e0e0e;
  border-right: 1px solid rgba(255,255,255,0.07);
}

.time-axis-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: #0e0e0e;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

/* Small dot on the time axis that aligns with the fixed center line */
.now-axis-dot {
  position: absolute;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53e3e;
  transform: translate(50%, -50%);
  z-index: 50;
  box-shadow: 0 0 6px rgba(229,62,62,0.8);
}

.time-cell {
  position: relative;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.time-label {
  position: absolute;
  top: -9px;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.28);
  letter-spacing: 0.03em;
}

/* ── Stages ── */
.stages-area {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
}

.stage-col {
  position: relative;
  flex: 1;
  min-width: 200px;
  border-right: 1px solid rgba(255,255,255,0.05);
}
.stage-col:last-child { border-right: none; }

.stage-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  padding: 0 12px;
  background: rgba(14,14,14,0.97);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
  letter-spacing: 0.01em;
}

.stage-body { position: relative; }

.grid-line { border-bottom: 1px solid rgba(255,255,255,0.035); }

/* ── Talk card ── */
.talk-card {
  position: absolute;
  inset-inline: 5px;
  border: 1px solid;
  border-radius: 10px;
  padding: 8px 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.talk-type {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  line-height: 1;
}
.talk-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  color: #fff;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.talk-time {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  font-variant-numeric: tabular-nums;
}

.talk-speakers { margin-top: 4px; display: flex; flex-direction: column; gap: 4px; }
.talk-speaker { display: flex; align-items: center; gap: 6px; }
.speaker-img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.12);
}
.speaker-name {
  font-size: 11px;
  color: rgba(255,255,255,0.65);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Empty state ── */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.3);
  font-size: 18px;
}
</style>
