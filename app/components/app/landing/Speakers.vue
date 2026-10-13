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
    return queryCollection('speakers').where('featured', '=', true).where('currentEvent', '=', true)
      .order('name', 'ASC').all()
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
      <!-- A curated list is complete in itself, so it does not link on to the speakers page. -->
      <AppSpeakerGrid :is-all-speakers="Boolean(slugs?.length)" :speakers="speakers" />
    </UPageSection>
  </template>
</template>
