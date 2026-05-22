<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  description?: string
  headline?: string
  direction?: 'left' | 'right'
  speed?: number
  gap?: number
  imageHeight?: number
}>(), {
  direction: 'left',
  speed: 40,
  gap: 60,
  imageHeight: 48,
})

const { data: sponsors } = await useAsyncData('sponsors-marquee', () =>
  queryCollection('sponsors').all(),
)

const style = computed(() => ({
  '--marquee-duration': `${props.speed}s`,
  '--marquee-gap': `${props.gap}px`,
  '--marquee-img-height': `${props.imageHeight}px`,
}))
</script>

<template>
  <UPageSection
    v-if="sponsors?.length"
    :description="description"
    :headline="headline"
    :title="title"
  >
    <div class="relative flex overflow-hidden" :style="style">
      <div
        class="flex shrink-0 items-center justify-start gap-(--marquee-gap) animate-marquee"
        :class="{ 'animate-marquee-reverse': direction === 'right' }"
      >
        <NuxtImg
          v-for="sponsor in sponsors"
          :key="sponsor.slug"
          :alt="sponsor.slug"
          class="max-w-none object-contain"
          :style="{ height: 'var(--marquee-img-height)' }"
          loading="lazy"
          :src="sponsor.image"
        />
      </div>
      <div
        aria-hidden="true"
        class="flex shrink-0 items-center justify-start gap-(--marquee-gap) animate-marquee ml-(--marquee-gap)"
        :class="{ 'animate-marquee-reverse': direction === 'right' }"
      >
        <NuxtImg
          v-for="sponsor in sponsors"
          :key="`clone-${sponsor.slug}`"
          :alt="sponsor.slug"
          class="max-w-none object-contain"
          :style="{ height: 'var(--marquee-img-height)' }"
          loading="lazy"
          :src="sponsor.image"
        />
      </div>
    </div>
  </UPageSection>
</template>

<style scoped>
.animate-marquee {
  animation: marquee var(--marquee-duration) linear infinite;
}

.animate-marquee-reverse {
  animation-direction: reverse;
}

@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - var(--marquee-gap))); }
}
</style>
