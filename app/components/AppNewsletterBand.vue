<script setup lang="ts">
// Slim newsletter sign-up shown above the footer on every page. The homepage
// has its own, larger newsletter block, so the band stays away from there.
const route = useRoute()
const { t } = useI18n()
</script>

<template>
  <section v-if="route.path !== '/'" class="border-t border-default bg-muted/40 py-12">
    <UContainer class="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
      <div>
        <p class="text-[13px] font-bold uppercase tracking-widest text-primary-400">
          {{ t('newsletter.band.headline') }}
        </p>
        <h2 class="mt-2 text-2xl font-extrabold tracking-tight text-highlighted">
          {{ t('newsletter.band.title') }}
        </h2>
        <p class="mt-2 text-muted">
          {{ t('newsletter.band.description') }}
        </p>
      </div>

      <AppNewsletterForm compact />
    </UContainer>
  </section>
</template>
