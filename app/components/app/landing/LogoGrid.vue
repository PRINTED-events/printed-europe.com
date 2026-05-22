<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  logos: {
    src: string
    alt?: string
    url?: string
  }[]
}>()
</script>

<template>
  <UPageSection
    :description="description"
    :headline="headline"
    :title="title"
  >
    <UPageGrid>
      <UPageCard
        v-for="logo in logos"
        :key="logo.src"
        class="flex h-24 items-center justify-center p-4"
        :rel="logo.url ? 'noopener noreferrer' : undefined"
        spotlight
        :target="logo.url ? '_blank' : undefined"
        :to="logo.url"
        variant="subtle"
      >
        <NuxtImg
          :alt="logo.alt ?? ''"
          class="mx-auto h-12 w-full object-contain"
          loading="lazy"
          :src="logo.src"
        />
      </UPageCard>
    </UPageGrid>
  </UPageSection>
</template>
