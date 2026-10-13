<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  logos: {
    src: string
    alt?: string
    url?: string
  }[]
}>()
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer class="grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <AppLandingBlockHead
        :description="description"
        :headline="headline"
        :title="title"
      />
      <div
        class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-default bg-(--ui-border)
        sm:grid-cols-3"
      >
        <component
          :is="logo.url ? 'a' : 'div'"
          v-for="logo in logos"
          :key="logo.src"
          class="flex h-24 items-center justify-center bg-default px-5 py-4"
          :href="logo.url"
          :rel="logo.url ? 'noopener noreferrer' : undefined"
          :target="logo.url ? '_blank' : undefined"
        >
          <NuxtImg
            :alt="logo.alt ?? ''"
            class="max-h-9 w-auto max-w-full object-contain opacity-85"
            loading="lazy"
            :src="logo.src"
          />
        </component>
      </div>
    </UContainer>
  </section>
</template>
