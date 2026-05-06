<script setup lang="ts">
const props = defineProps<{
  title?: string
  description?: string
  headline?: string
  reverse?: boolean
  items?: string[]
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
  links?: {
    label: string
    to: string
    icon?: string
    target?: string
    variant?: string
    size?: string
  }[]
}>()

const hasMedia = computed(() => !!(props.image || props.images?.length || props.logos?.length))
const effectiveOrientation = computed(() => hasMedia.value ? 'horizontal' as const : 'vertical' as const)
</script>

<template>
  <UPageSection
    :description="description"
    :headline="headline"
    :links="links"
    :orientation="effectiveOrientation"
    :reverse="hasMedia ? reverse : false"
    :title="title"
  >
    <template v-if="items?.length" #features>
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
    </template>

    <div v-if="hasMedia" class="flex flex-col gap-6">
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
      <div
        v-if="logos?.length"
        class="grid grid-cols-2 gap-3"
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
    </div>
  </UPageSection>
</template>
