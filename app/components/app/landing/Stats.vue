<script setup lang="ts">
defineProps<{
  title?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  items: {
    value: string
    suffix?: string
    label: string
  }[]
}>()
</script>

<template>
  <section :aria-label="title" class="border-y border-default bg-muted">
    <UContainer class="grid grid-cols-2 gap-6 py-11 md:grid-cols-4">
      <div v-for="item in items" :key="item.label">
        <b class="block text-4xl sm:text-5xl font-black tracking-tighter tabular-nums text-highlighted">
          {{ item.value }}<span v-if="item.suffix" class="text-primary-400">{{ item.suffix }}</span>
        </b>
        <span class="text-[15px] text-muted">{{ item.label }}</span>
      </div>
    </UContainer>
  </section>
</template>
