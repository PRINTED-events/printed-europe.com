<script setup lang="ts">
const { locale, t } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const { data: tickets } = await useAsyncData(
  'tickets-all',
  async () => {
    // Ticket content lives at `tickets/` for the default locale and at
    // `<locale>/tickets/` for translations. Fall back per ticket so a partially
    // translated set still renders completely, and so the default locale keeps
    // defining the order in which the tickets are shown.
    const defaults = await queryCollection('tickets')
      .where('stem', 'LIKE', 'tickets/%')
      .all()

    if (locale.value === 'en')
      return defaults

    const localized = await queryCollection('tickets')
      .where('stem', 'LIKE', `${locale.value}/tickets/%`)
      .all()

    const localizedBySlug = new Map(localized.map(ticket => [ticket.slug, ticket]))
    return defaults.map(ticket => localizedBySlug.get(ticket.slug) ?? ticket)
  },
  { watch: [locale] },
)

const seoMetadata = computed(() => extractSeoMetadata({
  title: t('tickets.title'),
  description: t('tickets.description'),
}))

const meta = computed(() => getSeoMetaBase(seoMetadata.value))

useSeoMeta({
  title: () => meta.value.title,
  ogTitle: () => meta.value.ogTitle,
  description: () => meta.value.description,
  ogDescription: () => meta.value.ogDescription,
})

defineOgImageComponent('DefaultSatori', {
  headline: t('tickets.title'),
  title: seoMetadata.value.title,
  description: seoMetadata.value.description,
})
</script>

<template>
  <template v-if="tickets">
    <UContainer class="pt-3 pb-8">
      <UBreadcrumb
        :items="[
          { label: t('common.home'), to: '/' },
          { label: t('tickets.title') },
        ]"
      />

      <UPageHeader
        :description="seoMetadata.description"
        :title="seoMetadata.title"
      />

      <UPricingPlans :plans="tickets" />

      <AccessibilityNote />
    </UContainer>
  </template>
</template>
