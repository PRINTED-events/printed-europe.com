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
  <section v-if="sponsors?.length" class="relative isolate py-16 sm:py-24 lg:py-32">
    <!-- Centered header -->
    <div
      v-if="headline || title || description"
      class="w-full max-w-(--ui-container) mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10"
    >
      <p v-if="headline" class="mb-3 font-semibold text-sm text-primary">
        {{ headline }}
      </p>
      <h2 v-if="title" class="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-highlighted">
        {{ title }}
      </h2>
      <p v-if="description" class="mt-6 text-base sm:text-lg text-muted">
        {{ description }}
      </p>
    </div>

    <!-- Full-width scrolling band -->
    <div class="relative flex overflow-hidden py-4" :style="style">
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
  </section>
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
