<script setup lang="ts">
definePageMeta({ layout: 'embed' })

const EDUCATION_DAY = '2026-09-25'

const {
  activeDayISO,
  stages,
  timeSlots,
  currentTimeLineStyle,
  getTalkStyle,
  getTalksForStage,
  activeTalks,
  availableTalkTypes,
} = await useSchedule()

onMounted(() => {
  if (activeDayISO.value !== EDUCATION_DAY) {
    activeDayISO.value = EDUCATION_DAY
  }
})
</script>

<template>
  <div class="p-4">
    <div v-if="stages && stages.length > 0 && activeTalks.length > 0">
      <AppScheduleGrid
        :current-time-line-style="currentTimeLineStyle"
        :get-talk-style="getTalkStyle"
        :get-talks-for-stage="getTalksForStage"
        :stages="stages"
        :time-slots="timeSlots"
      />
      <AppScheduleLegend :available-talk-types="availableTalkTypes" />
    </div>
    <div
      v-else
      class="py-12 text-center text-neutral-500"
    >
      No talks scheduled yet.
    </div>
  </div>
</template>
