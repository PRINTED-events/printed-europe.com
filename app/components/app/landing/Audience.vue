<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  image?: {
    src: string
    alt?: string
  }
  items: {
    text: string
    reply: string
  }[]
}>()
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer class="grid items-center gap-9 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <div v-if="image" class="aspect-16/11 overflow-hidden rounded-lg lg:aspect-4/5">
        <NuxtImg
          :alt="image.alt"
          class="size-full object-cover object-[40%_center]"
          loading="lazy"
          :src="image.src"
        />
      </div>
      <div>
        <AppLandingBlockHead
          :description="description"
          :headline="headline"
          :title="title"
        />
        <ul class="mt-9 border-t border-default">
          <li
            v-for="item in items"
            :key="item.text"
            class="flex items-baseline justify-between gap-4 border-b border-default py-4"
          >
            <p class="text-lg font-medium text-highlighted">
              {{ item.text }}
            </p>
            <span class="whitespace-nowrap text-sm font-bold text-primary-400">{{ item.reply }}</span>
          </li>
        </ul>
      </div>
    </UContainer>
  </section>
</template>
