<script setup lang="ts">
// Left-aligned section heading shared by the "family" landing blocks.
defineProps<{
  title?: string
  description?: string
  headline?: string
}>()
</script>

<template>
  <div>
    <p v-if="headline" class="mb-3 font-semibold text-primary">
      {{ headline }}
    </p>
    <h2
      v-if="title"
      class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-balance text-highlighted"
    >
      {{ title }}
    </h2>
    <p v-if="description" class="mt-5 max-w-[62ch] text-lg text-muted">
      {{ description }}
    </p>
  </div>
</template>
