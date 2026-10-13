<script setup lang="ts">
const props = defineProps<{
  title?: string
  description?: string
  headline?: string
  // class?: string // works without using it due to Vue3's attribute fallthrough
  slugs?: string[]
}>()

const { data: speakers } = await useAsyncData(`speakers-landing-${props.slugs?.join(',') ?? 'featured'}`, async () => {
  if (!props.slugs?.length) {
    return queryCollection('speakers').where('featured', '=', true).order('featured', 'DESC').order('name', 'ASC')
      .all()
  }
  // A curated list keeps the order it was written in.
  const picked = await queryCollection('speakers').where('slug', 'IN', props.slugs).all()
  return props.slugs.flatMap(slug => picked.filter(speaker => speaker.slug === slug))
})
</script>

<template>
  <template v-if="speakers && speakers.length > 0">
    <UPageSection
      :description="description"
      :headline="headline"
      :title="title"
    >
      <AppSpeakerGrid :speakers="speakers" />
    </UPageSection>
  </template>
</template>
