<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const props = defineProps<{
  title?: string
  description?: string
  headline?: string
  reverse?: boolean
  items?: string[]
  talksStage?: string
  image?: {
    src: string
    alt?: string
  }
  images?: {
    src: string
    alt?: string
  }[]
  logos?: {
    src: string
    alt?: string
    url?: string
  }[]
  links?: ButtonProps[]
}>()

const { t } = useI18n()

const { data: stageTalks } = await useAsyncData(
  `venue-talks-${props.talksStage}`,
  () => props.talksStage
    ? queryCollection('talks')
        .where('stage', '=', props.talksStage)
        .order('dateTime', 'ASC')
        .all()
    : Promise.resolve([]),
)

const uniqueTalks = computed(() => {
  if (!stageTalks.value?.length) return []
  const seen = new Set<string>()
  return stageTalks.value.filter((talk: any) => {
    if (seen.has(talk.title)) return false
    seen.add(talk.title)
    return true
  })
})

const hasImage = computed(() => !!(props.image || props.images?.length))
const effectiveOrientation = computed(() => hasImage.value ? 'horizontal' as const : 'vertical' as const)
</script>

<template>
  <UPageSection
    :description="description"
    :headline="headline"
    :links="links"
    :orientation="effectiveOrientation"
    :reverse="hasImage ? reverse : false"
    :title="title"
  >
    <template #body>
      <ul v-if="items?.length" class="space-y-2">
        <li
          v-for="item in items"
          :key="item"
          class="flex items-start gap-2"
        >
          <UIcon
            class="mt-0.5 shrink-0 text-primary"
            name="i-lucide-arrow-right"
          />
          <span class="text-muted">{{ item }}</span>
        </li>
      </ul>

      <div v-if="uniqueTalks.length" class="mt-4 space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('landing.workshopsAndTalks') }}</p>
        <ul class="space-y-1.5">
          <li
            v-for="talk in uniqueTalks"
            :key="(talk as any).slug"
            class="flex items-start gap-2"
          >
            <UIcon
              class="mt-0.5 shrink-0 text-teal-500"
              name="i-lucide-calendar-check"
            />
            <NuxtLink
              class="text-sm text-muted hover:text-primary transition-colors"
              :to="`/talks/${(talk as any).slug}`"
            >
              {{ (talk as any).title }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div
        v-if="logos?.length"
        class="grid grid-cols-2 gap-3 mt-6"
        :class="logos.length >= 3 ? 'sm:grid-cols-3' : ''"
      >
        <UPageCard
          v-for="logo in logos"
          :key="logo.src"
          class="flex h-20 items-center justify-center p-3"
          :rel="logo.url ? 'noopener noreferrer' : undefined"
          spotlight
          :target="logo.url ? '_blank' : undefined"
          :to="logo.url"
          variant="subtle"
        >
          <NuxtImg
            :alt="logo.alt ?? ''"
            class="mx-auto h-10 w-full object-contain"
            loading="lazy"
            :src="logo.src"
          />
        </UPageCard>
      </div>
    </template>

    <div v-if="image || images?.length" class="flex flex-col gap-2">
      <NuxtImg
        v-if="image && !images?.length"
        :alt="image.alt ?? title ?? ''"
        class="w-full rounded-xl shadow-lg object-cover"
        loading="lazy"
        :src="image.src"
      />
      <div
        v-if="images?.length"
        class="grid gap-2"
        :class="images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <NuxtImg
          v-for="(img, i) in images"
          :key="img.src"
          :alt="img.alt ?? title ?? ''"
          class="w-full rounded-xl shadow-lg object-cover aspect-square"
          :class="images.length % 2 !== 0 && i === images.length - 1 ? 'col-span-2 aspect-video' : ''"
          loading="lazy"
          :src="img.src"
        />
      </div>
    </div>
  </UPageSection>
</template>
