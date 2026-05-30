<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  height?: 'normal' | 'small'
  items: {
    icon: string
    text: string
    label?: string
  }[]
}>()
</script>

<template>
  <div class="meta-info-with-bg">
    <UPageSection
      :class="['meta-info-section', { 'md:-my-[70px] relative z-10': height === 'small' }]"
      :description="description"
      :headline="headline"
      :title="title"
    >
      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="flex items-center gap-4"
        >
          <div class="shrink-0">
            <div
              class="flex items-center justify-center w-12 h-12 rounded-lg bg-primary-900/40 text-primary-300"
            >
              <UIcon class="w-6 h-6" :name="item.icon" />
            </div>
          </div>
          <div>
            <p v-if="item.label" class="text-sm font-medium text-neutral-300">
              {{ item.label }}
            </p>
            <p class="text-lg font-semibold text-white">
              {{ item.text }}
            </p>
          </div>
        </div>
      </div>
    </UPageSection>
  </div>
</template>

<style>
.meta-info-with-bg {
  background: linear-gradient(rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.92)),
    url('/venues/3-community-showcase/printedhub25-011.jpg') center top / cover no-repeat;
}
.meta-info-with-bg :is(h1, h2, h3, h4) {
  color: white;
}
.meta-info-with-bg p {
  color: rgb(212, 212, 216);
}
.meta-info-with-bg > *,
.meta-info-with-bg > * > [class*="py-"],
.meta-info-with-bg .meta-info-section {
  padding-top: 1.5rem !important;
  padding-bottom: 1.5rem !important;
}
@media (min-width: 1024px) {
  .meta-info-with-bg > *,
  .meta-info-with-bg > * > [class*="py-"],
  .meta-info-with-bg .meta-info-section {
    padding-top: 2.5rem !important;
    padding-bottom: 2.5rem !important;
  }
}
</style>
