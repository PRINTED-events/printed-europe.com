<script setup lang="ts">
const props = defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  videoUrl?: string
}>()

const { t } = useI18n()

const videoId = computed(() => getYouTubeVideoId(props.videoUrl))
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer>
      <AppLandingBlockHead
        :description="description"
        :headline="headline"
        :title="title"
      />

      <div
        v-if="videoId"
        class="group relative mt-10 aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-default"
      >
        <ScriptYouTubePlayer
          class="size-full"
          :player-options="{
            host: 'https://www.youtube-nocookie.com',
          }"
          :video-id="videoId"
        >
          <template #awaitingLoad>
            <div class="absolute inset-0 flex items-center justify-center bg-black/30">
              <span
                class="flex size-16 items-center justify-center rounded-full bg-primary-500 text-white
                transition-transform duration-300 group-hover:scale-110"
              >
                <UIcon class="size-7 translate-x-0.5" name="i-lucide-play" />
              </span>
            </div>
          </template>
        </ScriptYouTubePlayer>
      </div>

      <div
        v-else
        class="video-pending mt-10 flex aspect-video items-center justify-center rounded-lg border border-default
        bg-muted"
      >
        <span
          class="rounded-sm border border-default bg-default px-3 py-1.5 text-xs font-medium uppercase
          tracking-widest text-muted"
        >{{ t('landing.videoPending') }}</span>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
.video-pending {
  background-image: repeating-linear-gradient(135deg, var(--ui-border) 0 1px, transparent 1px 9px);
}
</style>
