<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

// A highlighted band for one current announcement, e.g. an open call for papers.
const props = defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  icon?: string
  links?: ButtonProps[]
  // Hides the block from this moment on (ISO date and time).
  until?: string
}>()

// Decided once on the server and passed to the client, so both render the same.
const visible = useState(`callout-${props.until ?? 'always'}`, () => !props.until || new Date() < new Date(props.until))
</script>

<template>
  <section v-if="visible" class="py-8 sm:py-12">
    <UContainer>
      <div
        class="relative isolate overflow-hidden rounded-lg border border-primary/40 bg-primary/10 p-7 sm:p-10
        flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between"
      >
        <div
          class="absolute -z-10 rounded-full bg-primary blur-[160px] size-56 -right-16 -top-24 opacity-40"
        />
        <div class="flex gap-5">
          <UIcon
            v-if="icon"
            class="hidden sm:block size-10 shrink-0 text-primary-400"
            :name="icon"
          />
          <div>
            <p v-if="headline" class="mb-2 text-[13px] font-bold uppercase tracking-widest text-primary-400">
              {{ headline }}
            </p>
            <h2 v-if="title" class="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance text-highlighted">
              {{ title }}
            </h2>
            <p v-if="description" class="mt-3 max-w-[62ch] text-muted">
              {{ description }}
            </p>
          </div>
        </div>

        <div v-if="links?.length" class="flex flex-wrap gap-3 shrink-0">
          <UButton
            v-for="(link, index) in links"
            :key="index"
            v-bind="link"
          />
        </div>
      </div>
    </UContainer>
  </section>
</template>
