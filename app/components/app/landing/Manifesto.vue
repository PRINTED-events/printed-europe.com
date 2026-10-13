<script setup lang="ts">
defineProps<{
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  lead?: string
  text?: string
  accent?: string
  items?: {
    not: string
    instead: string
  }[]
}>()
</script>

<template>
  <section class="py-20 sm:py-28">
    <UContainer>
      <p v-if="headline" class="mb-3 font-semibold text-primary">
        {{ headline }}
      </p>
      <p class="max-w-[26ch] text-3xl sm:text-4xl lg:text-[44px] font-bold leading-[1.22] tracking-tight text-balance">
        <span v-if="lead" class="text-dimmed">{{ lead }}</span>
        {{ text }}
        <span v-if="accent" class="text-primary-400">{{ accent }}</span>
      </p>

      <div
        v-if="items?.length"
        class="mt-16 grid gap-px overflow-hidden rounded-lg border border-default bg-(--ui-border) md:grid-cols-3"
      >
        <div
          v-for="item in items"
          :key="item.not"
          class="bg-default px-6 py-6"
        >
          <s class="text-[15px] text-dimmed decoration-primary/70 decoration-2">{{ item.not }}</s>
          <p class="mt-1.5 text-lg font-semibold text-highlighted">
            {{ item.instead }}
          </p>
        </div>
      </div>
    </UContainer>
  </section>
</template>
