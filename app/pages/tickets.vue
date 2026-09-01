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

// Contact details for accessibility questions, mirroring the legal notice.
const contactEmail = 'office@printed-events.com'
const contactPhone = '+49 152 342 844 07'

// The paragraphs of the accessibility box, in display order. Each one is
// rendered through `i18n-t`, so any of them may embed the contact links.
const accessibilityTopics = [
  'halls',
  'route',
  'parking',
  'accompanying',
  'toilets',
  'questions',
] as const

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

      <UPageCard
        icon="lucide:accessibility"
        :title="t('tickets.accessibility.title')"
        :ui="{
          root: 'mt-12',
        }"
        variant="subtle"
      >
        <dl class="space-y-4 text-sm text-muted">
          <div
            v-for="topic in accessibilityTopics"
            :key="topic"
          >
            <dt class="inline font-semibold text-highlighted">
              {{ t(`tickets.accessibility.${topic}.label`) }}:
            </dt>
            <dd class="inline">
              <i18n-t
                :keypath="`tickets.accessibility.${topic}.text`"
                scope="global"
                tag="span"
              >
                <template #email>
                  <ULink :to="`mailto:${contactEmail}`">
                    {{ contactEmail }}
                  </ULink>
                </template>
                <template #phone>
                  <ULink :to="`tel:${contactPhone.replace(/\s/g, '')}`">
                    {{ contactPhone }}
                  </ULink>
                </template>
              </i18n-t>
            </dd>
          </div>
        </dl>
      </UPageCard>
    </UContainer>
  </template>
</template>
