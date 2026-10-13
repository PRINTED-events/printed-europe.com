<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'

const props = defineProps<{
  title?: string
  titleAccent?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  claim?: string[]
  links?: ButtonProps[]
  image?: {
    src: string
    alt?: string
  }
  editions?: {
    label: string
    text?: string
  }[]
  badge?: {
    greeting?: string
    names: string[]
    role?: string
    note?: string
  }
}>()

// The badge runs through the names in a random order, so everyone feels
// welcome. The first name stays fixed until the page is interactive, which
// keeps the server-rendered and the client-rendered markup identical.
const nameOrder = ref((props.badge?.names ?? []).map((_, index) => index))
const namePosition = ref(0)
const badgeName = computed(() => props.badge?.names[nameOrder.value[namePosition.value] ?? 0])
let timer: ReturnType<typeof setInterval> | undefined

function shuffled(count: number, first: number) {
  const order = Array.from({ length: count }, (_, index) => index).filter(index => index !== first)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return [first, ...order]
}

onMounted(() => {
  const count = props.badge?.names.length ?? 0
  if (count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return
  nameOrder.value = shuffled(count, 0)
  timer = setInterval(() => {
    namePosition.value = (namePosition.value + 1) % count
  }, 2200)
})

onUnmounted(() => clearInterval(timer))

const claimColors = ['text-white', 'text-primary-200', 'text-primary-400']
</script>

<template>
  <section class="relative isolate overflow-hidden py-20 sm:py-28 lg:pt-32 lg:pb-24">
    <div
      v-if="image"
      :aria-label="image.alt"
      class="absolute inset-0 -z-20 bg-cover bg-position-[center_38%]"
      role="img"
      :style="{ backgroundImage: `url('${image.src}')` }"
    />
    <div class="absolute inset-0 -z-20 bg-linear-to-b from-(--ui-bg)/55 via-(--ui-bg)/80 to-(--ui-bg)" />
    <div
      class="absolute -z-10 rounded-full bg-primary blur-[220px] size-60 sm:size-80 left-1/2 -translate-x-1/2
      -top-40"
    />
    <div class="absolute inset-0 -z-10 opacity-50">
      <LazyAppStarsBg
        :size="{
          min: 1,
          max: 3,
        }"
      />
    </div>

    <UContainer class="grid items-end gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <div>
        <p
          v-if="claim?.length"
          class="mb-6 flex flex-wrap gap-x-[0.55em] text-lg sm:text-2xl font-extrabold uppercase tracking-[0.14em]"
        >
          <span
            v-for="(word, index) in claim"
            :key="word"
            :class="claimColors[index % claimColors.length]"
          >{{ word }}</span>
        </p>
        <p v-if="headline" class="mb-4 font-semibold text-primary">
          {{ headline }}
        </p>
        <h1 class="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.98] text-balance text-white">
          {{ title }} <span v-if="titleAccent" class="text-primary-400">{{ titleAccent }}</span>
        </h1>
        <p v-if="description" class="mt-7 max-w-[56ch] text-lg sm:text-xl text-neutral-300">
          {{ description }}
        </p>

        <div v-if="links?.length" class="mt-9 flex flex-wrap gap-3">
          <UButton
            v-for="(link, index) in links"
            :key="index"
            v-bind="link"
          />
        </div>

        <ul v-if="editions?.length" class="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <li
            v-for="edition in editions"
            :key="edition.label"
            class="flex items-center gap-2"
          >
            <span class="size-2 rounded-full bg-primary" />
            <span><b class="font-semibold text-highlighted">{{ edition.label }}</b> {{ edition.text }}</span>
          </li>
        </ul>
      </div>

      <!-- The name badge: what you get handed at check-in -->
      <div v-if="badge" class="flex justify-start pt-28 lg:justify-center lg:pt-0 lg:pb-2">
        <div
          class="relative w-full max-w-[280px] rotate-3 rounded-2xl bg-[#fbf7f2] px-5 pt-11 pb-5 text-slate-900
          shadow-2xl ring-1 ring-white/10"
        >
          <div
            aria-hidden="true"
            class="absolute bottom-full left-1/2 h-40 w-[22px] -translate-x-1/2
            bg-[repeating-linear-gradient(180deg,var(--color-brand-500)_0_22px,var(--color-brand-600)_22px_44px)]"
          />
          <div
            aria-hidden="true"
            class="absolute left-1/2 top-3.5 h-2.5 w-14 -translate-x-1/2 rounded-md bg-(--ui-bg)"
          />
          <div
            class="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em]
            text-slate-600"
          >
            <span>PRINTED</span>
            <AppLogo class="h-5 w-auto invert" />
          </div>
          <p v-if="badge.greeting" class="mt-5 text-[13px] text-slate-500">
            {{ badge.greeting }}
          </p>
          <p
            aria-live="off"
            class="mt-0.5 min-h-12 border-b-2 border-dashed border-slate-300 pb-2.5 text-[34px] font-black
            leading-[1.05] tracking-tight"
          >
            {{ badgeName }}
          </p>
          <span
            v-if="badge.role"
            class="mt-3.5 inline-block rounded-full bg-primary-500 px-3 py-1 text-xs font-bold uppercase
            tracking-widest text-white"
          >{{ badge.role }}</span>
          <p v-if="badge.note" class="mt-3 text-[13px] leading-snug text-slate-600">
            {{ badge.note }}
          </p>
        </div>
      </div>
    </UContainer>
  </section>
</template>
