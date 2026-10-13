<script setup lang="ts">
const { t } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

// Only the speakers of the upcoming event are listed. Speakers of past events
// keep their profile page and are linked from the recap in `/archive`.
const { data: speakers } = await useAsyncData('speakers-current', () =>
  queryCollection('speakers').where('currentEvent', '=', true).order('featured', 'DESC').order('name', 'ASC').all())

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

      <AppSpeakerGrid
        v-if="speakers.length"
        is-all-speakers
        :speakers="speakers"
      />

      <UPageCard
        v-else
        class="mt-8"
        :description="t('speakers.comingSoon.description')"
        icon="i-lucide-mic-2"
        :title="t('speakers.comingSoon.title')"
        variant="subtle"
      />
    </UContainer>
  </template>
</template>
