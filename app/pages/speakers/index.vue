<script setup lang="ts">
const { t } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const { data: speakers } = await useAsyncData('speakers-all', () =>
  queryCollection('speakers').order('featured', 'DESC').all())

const seoMetadata = computed(() => extractSeoMetadata({
  title: t('speakers.title'),
  description: t('speakers.description'),
}))

const meta = computed(() => getSeoMetaBase(seoMetadata.value))

useSeoMeta({
  title: () => meta.value.title,
  ogTitle: () => meta.value.ogTitle,
  description: () => meta.value.description,
  ogDescription: () => meta.value.ogDescription,
})

defineOgImageComponent('DefaultSatori', {
  headline: t('speakers.title'),
  title: t('speakers.title'),
  description: t('speakers.ogDescription'),
})
</script>

<template>
  <template v-if="speakers">
    <UContainer class="pt-3 pb-8">
      <UBreadcrumb
        :items="[
          { label: t('common.home'), to: '/' },
          { label: t('speakers.title') },
        ]"
      />

      <UPageHeader
        :description="seoMetadata.description"
        :title="seoMetadata.title"
      />

      <AppSpeakerGrid is-all-speakers :speakers="speakers" />
    </UContainer>
  </template>
</template>
