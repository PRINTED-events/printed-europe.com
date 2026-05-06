<script setup lang="ts">
import {
  AppLandingCta,
  AppLandingFaqPreview,
  AppLandingFeatures,
  AppLandingFloorplan,
  AppLandingGallery,
  AppLandingHero,
  AppLandingHeroCountdown,
  AppLandingHeroMedia,
  AppLandingHeroSplit,
  AppLandingMarquee,
  AppLandingMetaInfo,
  AppLandingSection,
  AppLandingSeparator,
  AppLandingSpeakers,
  AppLandingSponsors,
  AppLandingTestimonials,
  AppLandingVenueArea,
} from '#components'
import { isNil } from 'lodash-es'

const componentsMap: Record<string, Component> = {
  AppLandingCta,
  AppLandingFaqPreview,
  AppLandingFeatures,
  AppLandingFloorplan,
  AppLandingGallery,
  AppLandingHero,
  AppLandingHeroCountdown,
  AppLandingHeroMedia,
  AppLandingHeroSplit,
  AppLandingMarquee,
  AppLandingMetaInfo,
  AppLandingSection,
  AppLandingSeparator,
  AppLandingSpeakers,
  AppLandingSponsors,
  AppLandingTestimonials,
  AppLandingVenueArea,
}

const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const { data: _page } = await useAsyncData('index-first', () => queryCollection('index').first())

if (isNil(_page.value)) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Landing Page Data not Found',
    fatal: true,
  })
}

// we tested above that these are not nil, so we can assert the types here safely by removing nil from them
const page = _page as globalThis.Ref<NonNullable<typeof _page.value>>

const renderedBlocks = computed(() => {
  if (!page.value?.blocks)
    return []

  return page.value.blocks
    .filter((block) => {
      if (!componentsMap[block.component]) {
        console.warn(`[Landing Page] Component "${block.component}" not found in componentsMap.`)
        return false
      }
      return true
    })
    .map((block, index) => {
      const { component: componentName, ...props } = block
      const Component = componentsMap[componentName]

      return {
        is: Component,
        props,
        key: `${componentName}-${index}`,
      }
    })
})

const seoMetadata = extractSeoMetadata(page.value)
// const { title, description } = seoMetadata

useSeoMeta({
  ...getSeoMetaBase(seoMetadata),
})

defineOgImageComponent('DefaultSatori', {
  headline: '25. – 26. September 2026 · Rüdesheim',
  title: 'PRINTED Hub 2026',
  description: '2 days of workshops, talks and community – the most special event for 3D printing in Europe.',
  image: '/printedhub25317.jpg',
})
</script>

<template>
  <div v-if="page.blocks">
    <template v-for="block in renderedBlocks" :key="block.key">
      <component :is="block.is" v-bind="block.props" />
    </template>
  </div>
</template>
