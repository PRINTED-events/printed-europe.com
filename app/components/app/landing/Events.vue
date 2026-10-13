<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  items: {
    meta?: string
    title: string
    description?: string
    image?: {
      src: string
      alt?: string
    }
    links?: ButtonProps[]
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

      <div class="mt-14 grid gap-6 md:grid-cols-2">
        <article
          v-for="item in items"
          :key="item.title"
          class="flex flex-col overflow-hidden rounded-lg border border-default bg-muted"
        >
          <div v-if="item.image" class="aspect-video">
            <NuxtImg
              :alt="item.image.alt"
              class="size-full object-cover"
              loading="lazy"
              :src="item.image.src"
            />
          </div>
          <div class="flex flex-1 flex-col gap-3 p-7">
            <p v-if="item.meta" class="text-[13px] font-bold uppercase tracking-widest text-primary-400">
              {{ item.meta }}
            </p>
            <h3 class="text-2xl sm:text-[28px] font-extrabold tracking-tight text-highlighted">
              {{ item.title }}
            </h3>
            <p v-if="item.description" class="text-muted">
              {{ item.description }}
            </p>
            <div v-if="item.links?.length" class="mt-auto flex flex-wrap gap-3 pt-2">
              <UButton
                v-for="(link, index) in item.links"
                :key="index"
                v-bind="link"
              />
            </div>
          </div>
        </article>
      </div>
    </UContainer>
  </section>
</template>
