<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  images: {
    src: string
    alt?: string
    caption?: string
  }[]
}>()

// Uneven rhythm, repeated every seven tiles: 4+2 / 2+2+2 / 3+3 of six columns.
const spans = [4, 2, 2, 2, 2, 3, 3].map(span => ({ 4: 'md:col-span-4', 3: 'md:col-span-3', 2: 'md:col-span-2' })[span])
const wideOnMobile = [0, 5]
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer>
      <AppLandingBlockHead
        :description="description"
        :headline="headline"
        :title="title"
      />

      <div class="mt-14 grid grid-cols-2 gap-3 md:grid-cols-6">
        <figure
          v-for="(image, index) in images"
          :key="image.src"
          class="group relative h-40 overflow-hidden rounded-lg md:h-[340px]"
          :class="[spans[index % 7], wideOnMobile.includes(index % 7) ? 'col-span-2 h-72' : '']"
        >
          <NuxtImg
            :alt="image.alt"
            class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            :src="image.src"
          />
          <figcaption
            v-if="image.caption"
            class="absolute inset-x-0 bottom-0 bg-linear-to-t from-(--ui-bg)/90 to-transparent px-4 pt-10 pb-3.5
            text-sm font-semibold text-white"
          >
            {{ image.caption }}
          </figcaption>
        </figure>
      </div>
    </UContainer>
  </section>
</template>
