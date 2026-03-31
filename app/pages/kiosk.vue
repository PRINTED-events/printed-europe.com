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

// ── Stage filter ─────────────────────────────────────────────
const selectedStages = ref<Set<string>>(new Set())
watch(stages, (val) => {
  if (val) val.forEach(s => selectedStages.value.add(s.slug))
}, { immediate: true })

const visibleStages = computed(() =>
  (stages.value ?? []).filter(s => selectedStages.value.has(s.slug)))

function toggleStage(slug: string) {
  if (selectedStages.value.has(slug)) {
    if (selectedStages.value.size > 1) selectedStages.value.delete(slug)
  } else {
    selectedStages.value.add(slug)
  }
  resetHideTimer()
}

// ── Active talks ─────────────────────────────────────────────
const activeTalks = computed(() => processedTalks.value.filter(t => t.start.toISODate() === selectedDay.value))

// ── Grid geometry ────────────────────────────────────────────
const HEADER_H = 52
const HOUR_H = 150
const PAGE_HEADER_H = 60

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

const SPEAKER_CARD_MIN_H = 110

function getTalkStyle(talk: any) {
  const startMin = (talk.start.hour - timeRange.value.start) * 60 + talk.start.minute
  const top = (startMin / 60) * HOUR_H
  const hasSpeakers = talk.speakers?.some((s: any) => s.slug)
  const minH = hasSpeakers ? SPEAKER_CARD_MIN_H : 36
  const height = Math.max((talk.duration / 60) * HOUR_H, minH)
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

const timeLineTop = computed(() => {
  const minutesFromStart = (now.value.hour - timeRange.value.start) * 60 + now.value.minute
  const totalMinutes = (timeRange.value.end - timeRange.value.start) * 60
  if (minutesFromStart < 0 || minutesFromStart > totalMinutes) return null
  return HEADER_H + (minutesFromStart / 60) * HOUR_H
})

const scrollEl = ref<HTMLElement | null>(null)
const userScrolling = ref(false)
let scrollPauseTimer: ReturnType<typeof setTimeout>

function centerScroll(smooth = false) {
  if (!scrollEl.value || timeLineTop.value === null) return
  const target = timeLineTop.value - scrollEl.value.clientHeight / 3
  scrollEl.value.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'instant' })
}

function onUserScroll() {
  userScrolling.value = true
  clearTimeout(scrollPauseTimer)
  scrollPauseTimer = setTimeout(() => {
    userScrolling.value = false
    centerScroll(true)
  }, 3000)
}

onMounted(() => {
  now.value = DateTime.now().setZone(timeZone)
  nextTick(() => centerScroll(false))
  clockTimer = setInterval(() => {
    now.value = DateTime.now().setZone(timeZone)
    if (!userScrolling.value) centerScroll(true)
  }, 1000)
})
onUnmounted(() => {
  clearInterval(clockTimer)
  clearTimeout(scrollPauseTimer)
})

const clockHours = computed(() => now.value.toFormat('HH'))
const clockMinutes = computed(() => now.value.toFormat('mm'))

// ── Admin panel visibility ───────────────────────────────────
const showControls = ref(false)
let hideTimer: ReturnType<typeof setTimeout>

function toggleControls() {
  showControls.value = !showControls.value
  if (showControls.value) resetHideTimer()
  else clearTimeout(hideTimer)
}

function resetHideTimer() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { showControls.value = false }, 6000)
}

onUnmounted(() => clearTimeout(hideTimer))

// ── Fullscreen ───────────────────────────────────────────────
const isFullscreen = ref(false)

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen()
  else document.exitFullscreen()
  resetHideTimer()
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
    default:         return { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.28)', accent: '#94a3b8' }
  }
}

function typeLabel(type: string) {
  return (type || '').split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
</script>

<template>
  <div class="kiosk-root">

    <!-- ── Always-visible top bar ─────────────────────────── -->
    <header class="kiosk-bar">
      <!-- Logo — click to reveal controls -->
      <button class="logo-btn" :class="{ active: showControls }" @click="toggleControls">
        <img src="/printed-pd-02.png" alt="PRINTED Europe" class="logo-img">
      </button>

      <!-- Clock -->
      <div class="kiosk-clock">
        <span class="clock-digits">{{ clockHours }}</span>
        <span class="clock-sep">:</span>
        <span class="clock-digits">{{ clockMinutes }}</span>
      </div>
    </header>

    <!-- ── Sliding admin panel ────────────────────────────── -->
    <Transition name="panel">
      <div v-if="showControls" class="admin-panel" @mouseenter="resetHideTimer">
        <div class="admin-inner">

          <!-- Date -->
          <div class="admin-group">
            <div class="admin-group-label">Datum</div>
            <div class="admin-row">
              <button class="ctrl-btn" :class="{ active: autoMode }" @click="autoMode = true; resetHideTimer()">
                Auto
              </button>
              <button class="ctrl-btn" :class="{ active: !autoMode }" @click="autoMode = false; resetHideTimer()">
                Manuell
              </button>
              <select v-if="!autoMode" v-model="manualDate" class="date-select" @change="resetHideTimer">
                <option v-for="day in availableDays" :key="day" :value="day">
                  {{ DateTime.fromISO(day).setLocale('de').toFormat('EEE, dd. MMM yyyy') }}
                </option>
              </select>
              <span v-else class="date-label">
                {{ selectedDay ? DateTime.fromISO(selectedDay).setLocale('de').toFormat('EEEE, dd. MMMM yyyy') : '—' }}
              </span>
            </div>
          </div>

          <!-- Stage filter -->
          <div class="admin-group">
            <div class="admin-group-label">Stages anzeigen</div>
            <div class="admin-row">
              <button
                v-for="stage in stages"
                :key="stage.slug"
                class="ctrl-btn"
                :class="{ active: selectedStages.has(stage.slug) }"
                @click="toggleStage(stage.slug)"
              >
                {{ stage.name }}
              </button>
            </div>
          </div>

          <!-- Fullscreen -->
          <button class="fullscreen-btn" :title="isFullscreen ? 'Vollbild beenden' : 'Vollbild'" @click="toggleFullscreen">
            <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
              <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
              <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
            </svg>
            {{ isFullscreen ? 'Vollbild beenden' : 'Vollbild' }}
          </button>

        </div>
      </div>
    </Transition>

    <!-- ── Fixed center timeline ──────────────────────────── -->
    <div class="fixed-timeline">
      <div class="fixed-now-badge">NOW</div>
    </div>

    <!-- ── Schedule ───────────────────────────────────────── -->
    <div
      v-if="visibleStages.length && activeTalks.length"
      ref="scrollEl"
      class="schedule-scroll"
      @scroll.passive="onUserScroll"
    >
      <div class="schedule-inner">

        <!-- Time axis -->
        <div class="time-axis">
          <div class="time-axis-header" :style="{ height: `${HEADER_H}px` }" />
          <div v-if="timeLineTop !== null" class="now-axis-dot" :style="{ top: `${timeLineTop}px` }" />
          <div v-for="h in timeSlots" :key="h" class="time-cell" :style="{ height: `${HOUR_H}px` }">
            <span class="time-label">{{ formatHour(h) }}</span>
          </div>
        </div>

        <!-- Stages -->
        <div class="stages-area">
          <div v-for="stage in visibleStages" :key="stage.slug" class="stage-col">
            <div class="stage-header" :style="{ height: `${HEADER_H}px` }">
              {{ stage.name }}
            </div>
            <div class="stage-body">
              <div v-for="h in timeSlots" :key="`g-${h}`" class="grid-line" :style="{ height: `${HOUR_H}px` }" />

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

                <!-- Speaker avatars -->
                <div v-if="talk.speakers?.some((s: any) => s.slug)" class="talk-speakers">
                  <div class="avatar-stack">
                    <NuxtImg
                      v-for="(sp, i) in talk.speakers.filter((s: any) => s.image).slice(0, 6)"
                      :key="sp.slug"
                      :src="sp.image"
                      :alt="sp.name"
                      :title="sp.name"
                      class="avatar"
                      :style="{ zIndex: 6 - i }"
                      width="34"
                      height="34"
                    />
                  </div>
                  <span v-if="talk.speakers.filter((s: any) => s.slug).length === 1" class="speaker-solo-name">
                    {{ talk.speakers[0]?.name }}
                  </span>
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
/* ── Root ── */
.kiosk-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #0a0a0a;
  color: #fff;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

/* ── Top bar ── */
.kiosk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: v-bind('PAGE_HEADER_H + "px"');
  flex-shrink: 0;
  background: #0d0d0d;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  z-index: 200;
  position: relative;
}

/* Logo button */
.logo-btn {
  background: none;
  border: none;
  padding: 6px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
}
.logo-btn:hover, .logo-btn.active { background: rgba(255,255,255,0.07); }
.logo-img { height: 32px; width: auto; object-fit: contain; }

/* Clock */
.kiosk-clock {
  display: flex;
  align-items: baseline;
  gap: 1px;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 300;
  letter-spacing: -2px;
  line-height: 1;
}
.clock-digits {
  font-size: 38px;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.clock-sep {
  font-size: 32px;
  color: rgba(255,145,77,0.7);
  animation: blink 1s step-end infinite;
  margin-bottom: 3px;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* ── Admin panel ── */
.admin-panel {
  position: absolute;
  top: v-bind('PAGE_HEADER_H + "px"');
  left: 0;
  right: 0;
  z-index: 150;
  background: rgba(10,10,10,0.92);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.admin-inner {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px 20px;
  flex-wrap: wrap;
}

.admin-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.admin-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
}
.admin-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ctrl-btn {
  padding: 5px 13px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}
.ctrl-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
.ctrl-btn.active { background: rgba(255,145,77,0.16); border-color: #ff914d; color: #ff914d; }

.date-select {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  padding: 5px 10px;
  font-family: inherit;
  outline: none;
}
.date-label { font-size: 13px; color: rgba(255,255,255,0.5); font-weight: 500; }

.fullscreen-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  margin-left: auto;
}
.fullscreen-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

/* Panel slide transition */
.panel-enter-active, .panel-leave-active { transition: all 0.25s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Fixed center timeline ── */
.fixed-timeline {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(v-bind('PAGE_HEADER_H + "px"') + (100dvh - v-bind('PAGE_HEADER_H + "px"')) / 3);
  z-index: 100;
  pointer-events: none;
  border-top: 2px solid #e53e3e;
  box-shadow: 0 0 20px rgba(229,62,62,0.45), 0 0 50px rgba(229,62,62,0.12);
}
.fixed-now-badge {
  position: absolute;
  left: 8px;
  top: -10px;
  background: #e53e3e;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.08em;
}

/* ── Schedule scroll ── */
.schedule-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  scrollbar-width: none;
}
.schedule-scroll::-webkit-scrollbar { display: none; }
.schedule-inner { display: flex; min-width: 100%; }

/* ── Time axis ── */
.time-axis {
  position: sticky;
  left: 0;
  z-index: 30;
  width: 64px;
  flex-shrink: 0;
  background: #0d0d0d;
  border-right: 1px solid rgba(255,255,255,0.06);
}
.time-axis-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: #0d0d0d;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.now-axis-dot {
  position: absolute;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53e3e;
  transform: translate(50%, -50%);
  z-index: 50;
  box-shadow: 0 0 6px rgba(229,62,62,0.9);
}
.time-cell { position: relative; border-bottom: 1px solid rgba(255,255,255,0.04); }
.time-label {
  position: absolute;
  top: -9px;
  right: 6px;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.25);
}

/* ── Stages ── */
.stages-area { position: relative; display: flex; flex: 1; min-width: 0; }

.stage-col {
  position: relative;
  flex: 1;
  min-width: 180px;
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
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  padding: 0 10px;
  background: rgba(13,13,13,0.97);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.75);
  letter-spacing: 0.02em;
}

.stage-body { position: relative; }
.grid-line { border-bottom: 1px solid rgba(255,255,255,0.03); }

/* ── Talk card ── */
.talk-card {
  position: absolute;
  inset-inline: 4px;
  border: 1px solid;
  border-radius: 10px;
  overflow: hidden;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.talk-type {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  line-height: 1;
  flex-shrink: 0;
}
.talk-title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  color: #fff;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}
.talk-time {
  font-size: 10px;
  color: rgba(255,255,255,0.38);
  font-variant-numeric: tabular-nums;
}

/* Speaker avatars */
.talk-speakers {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}

.avatar-stack {
  display: flex;
  flex-direction: row;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  object-position: top center;
  border: 2px solid rgba(0,0,0,0.4);
  margin-left: -8px;
  flex-shrink: 0;
}
.avatar:first-child { margin-left: 0; }

.speaker-solo-name {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
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
