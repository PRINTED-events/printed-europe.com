<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const props = defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  items: {
    title: string
    speaker?: string
    // Recordings go online one by one: without a link the talk is listed as pending.
    to?: string
    image?: {
      src: string
      alt?: string
    }
  }[]
  links?: ButtonProps[]
}>()

const { t } = useI18n()

const onlineCount = computed(() => props.items.filter(item => item.to).length)

function thumbnail(item: (typeof props.items)[number]) {
  if (item.image?.src)
    return item.image.src
  const videoId = getYouTubeVideoId(item.to)
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : undefined
}
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer>
      <AppLandingBlockHead
        :description="description"
        :headline="headline"
        :title="title"
      />

      <p class="mt-10 flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted">
        {{ t('landing.recordingsOnline', { online: onlineCount, total: items.length }) }}
        <span class="h-px flex-1 bg-(--ui-border)" />
      </p>

      <ul class="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
        <li v-for="item in items" :key="item.title">
          <component
            :is="item.to ? 'a' : 'div'"
            class="group grid gap-2"
            :href="item.to"
            :rel="item.to ? 'noopener noreferrer' : undefined"
            :target="item.to ? '_blank' : undefined"
          >
            <span
              class="relative flex aspect-video items-center justify-center overflow-hidden rounded-md border
              border-default bg-muted"
              :class="{ 'talk-pending': !item.to }"
            >
              <template v-if="item.to">
                <img
                  v-if="thumbnail(item)"
                  :alt="item.image?.alt ?? ''"
                  class="size-full object-cover opacity-80 transition duration-300 group-hover:scale-105
                  group-hover:opacity-100"
                  loading="lazy"
                  :src="thumbnail(item)"
                >
                <span
                  class="absolute bottom-2 left-2 flex size-8 items-center justify-center rounded-full
                  bg-primary-500 text-white"
                >
                  <UIcon class="size-3.5 translate-x-px" name="i-lucide-play" />
                </span>
              </template>
              <span
                v-else
                class="rounded-sm border border-default bg-default px-2 py-1 text-[10px] font-medium uppercase
                tracking-widest text-muted"
              >{{ t('landing.recordingPending') }}</span>
            </span>
            <span
              class="text-sm leading-snug transition-colors"
              :class="item.to ? 'font-semibold text-highlighted group-hover:text-primary' : 'text-muted'"
            >{{ item.title }}</span>
            <span v-if="item.speaker" class="text-[11px] uppercase tracking-wider text-dimmed">
              {{ item.speaker }}
            </span>
          </component>
        </li>
      </ul>

      <div v-if="links?.length" class="mt-10 flex flex-wrap gap-3">
        <UButton
          v-for="(link, index) in links"
          :key="index"
          v-bind="link"
        />
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
.talk-pending {
  background-image: repeating-linear-gradient(135deg, var(--ui-border) 0 1px, transparent 1px 9px);
}
</style>
