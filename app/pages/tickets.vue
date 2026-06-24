<script setup lang="ts">
const { t } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const { data: tickets } = await useAsyncData('tickets-all', () => queryCollection('tickets').all())

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
    </UContainer>
  </template>
</template>
