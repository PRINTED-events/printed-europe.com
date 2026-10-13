<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'
import {
  AppLandingAudience,
  AppLandingCta,
  AppLandingEvents,
  AppLandingFaqPreview,
  AppLandingFeatures,
  AppLandingFloorplan,
  AppLandingGallery,
  AppLandingHero,
  AppLandingHeroCountdown,
  AppLandingHeroFamily,
  AppLandingHeroMedia,
  AppLandingHeroSplit,
  AppLandingLogoGrid,
  AppLandingManifesto,
  AppLandingMarquee,
  AppLandingMetaInfo,
  AppLandingMosaic,
  AppLandingPartners,
  AppLandingPillars,
  AppLandingSection,
  AppLandingSeparator,
  AppLandingSpeakers,
  AppLandingSponsorMarquee,
  AppLandingSponsors,
  AppLandingStats,
  AppLandingTalkVideos,
  AppLandingTestimonials,
  AppLandingVenueArea,
  AppLandingVideo,
} from '#components'

// Renders the `blocks` of a landing page: the homepage and the archive pages share it.
const props = defineProps<{
  blocks?: IndexCollectionItem['blocks']
}>()

const componentsMap: Record<string, Component> = {
  AppLandingAudience,
  AppLandingCta,
  AppLandingEvents,
  AppLandingFaqPreview,
  AppLandingFeatures,
  AppLandingFloorplan,
  AppLandingGallery,
  AppLandingHero,
  AppLandingHeroCountdown,
  AppLandingHeroFamily,
  AppLandingHeroMedia,
  AppLandingHeroSplit,
  AppLandingLogoGrid,
  AppLandingManifesto,
  AppLandingMarquee,
  AppLandingMetaInfo,
  AppLandingMosaic,
  AppLandingPartners,
  AppLandingPillars,
  AppLandingSection,
  AppLandingSeparator,
  AppLandingSpeakers,
  AppLandingSponsorMarquee,
  AppLandingSponsors,
  AppLandingStats,
  AppLandingTalkVideos,
  AppLandingTestimonials,
  AppLandingVenueArea,
  AppLandingVideo,
}

const renderedBlocks = computed(() => {
  return (props.blocks ?? [])
    .filter((block) => {
      if (!componentsMap[block.component]) {
        console.warn(`[Landing Page] Component "${block.component}" not found in componentsMap.`)
        return false
      }
      return true
    })
    .map((block, index) => {
      const { component: componentName, ...blockProps } = block
      const Component = componentsMap[componentName]

      return {
        is: Component,
        props: blockProps,
        key: `${componentName}-${index}`,
      }
    })
})
</script>

<template>
  <div>
    <template v-for="block in renderedBlocks" :key="block.key">
      <component :is="block.is" v-bind="block.props" />
    </template>
  </div>
</template>
