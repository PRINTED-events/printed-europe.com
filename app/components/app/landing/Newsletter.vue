<script setup lang="ts">
// Newsletter sign-up as a homepage block: heading and text next to the form.
defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  items?: string[]
}>()
</script>

<template>
  <section class="py-16 sm:py-24">
    <UContainer>
      <div
        class="relative isolate overflow-hidden rounded-lg border border-default bg-muted p-7 sm:p-12
        grid gap-10 lg:grid-cols-2 lg:gap-16"
      >
        <div class="absolute -z-10 rounded-full bg-primary blur-[200px] size-72 -left-24 -bottom-32 opacity-30" />
        <div>
          <AppLandingBlockHead
            :description="description"
            :headline="headline"
            :title="title"
          />
          <ul v-if="items?.length" class="mt-6 space-y-3">
            <li
              v-for="item in items"
              :key="item"
              class="flex gap-3"
            >
              <UIcon class="mt-1 size-5 shrink-0 text-primary" name="i-lucide-check" />
              <span class="text-muted">{{ item }}</span>
            </li>
          </ul>
        </div>

        <AppNewsletterForm class="lg:pt-2" />
      </div>
    </UContainer>
  </section>
</template>
