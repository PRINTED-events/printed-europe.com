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

const hasMedia = computed(() => !!(props.image || props.logos?.length))
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
        v-if="image"
        :alt="image.alt ?? title ?? ''"
        class="w-full rounded-xl shadow-lg object-cover"
        loading="lazy"
        :src="image.src"
      />
      <div
        v-if="logos?.length"
        class="flex flex-wrap items-center gap-6"
      >
        <a
          v-for="logo in logos"
          :key="logo.src"
          :href="logo.url"
          rel="noopener noreferrer"
          target="_blank"
          class="block"
        >
          <NuxtImg
            :alt="logo.alt ?? ''"
            class="h-12 w-auto object-contain"
            loading="lazy"
            :src="logo.src"
          />
        </a>
      </div>
    </div>
  </UPageSection>
</template>
