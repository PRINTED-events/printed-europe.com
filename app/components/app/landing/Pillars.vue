<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  items: {
    word: string
    title: string
    description?: string
    items?: string[]
    image?: {
      src: string
      alt?: string
    }
  }[]
}>()
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer>
      <AppLandingBlockHead
        :description="description"
        :headline="headline"
        :title="title"
      />

      <div class="mt-16 grid gap-16 lg:gap-24">
        <div
          v-for="(item, index) in items"
          :key="item.word"
          class="grid items-center gap-7 md:grid-cols-2 md:gap-14"
        >
          <div
            v-if="item.image"
            class="aspect-4/3 overflow-hidden rounded-lg"
            :class="{ 'md:order-2': index % 2 === 1 }"
          >
            <NuxtImg
              :alt="item.image.alt"
              class="size-full object-cover"
              loading="lazy"
              :src="item.image.src"
            />
          </div>
          <div>
            <p aria-hidden="true" class="pillar-word text-6xl sm:text-7xl lg:text-8xl font-black leading-[0.9]">
              {{ item.word }}
            </p>
            <h3 class="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-highlighted">
              {{ item.title }}
            </h3>
            <p v-if="item.description" class="mt-3.5 max-w-[48ch] text-muted">
              {{ item.description }}
            </p>
            <ul v-if="item.items?.length" class="mt-6 grid gap-2.5">
              <li
                v-for="point in item.items"
                :key="point"
                class="flex items-start gap-2.5"
              >
                <span class="mt-1.5 size-3 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
                <span>{{ point }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </UContainer>
  </section>
</template>

<style scoped>
.pillar-word {
  color: transparent;
  letter-spacing: -0.05em;
  -webkit-text-stroke: 1.5px var(--color-brand-400);
}
</style>
