<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  image?: {
    src: string
    alt?: string
  }
}>()
</script>

<template>
  <UPageSection
    :description="description"
    :headline="headline"
    :title="title"
  >
    <UContainer v-if="image">
      <NuxtImg
        :alt="image.alt ?? 'Venue Floorplan'"
        class="w-full rounded-xl shadow-lg"
        loading="lazy"
        :src="image.src"
      />
    </UContainer>
  </UPageSection>
</template>
