<script setup lang="ts">
import { isNil } from 'lodash-es'

const { locale } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const { data: _page } = await useAsyncData(
  'index-first',
  async () => {
    // Load the landing content for the active locale; fall back to the default
    // locale (`/`) if a localized variant does not exist yet.
    const localizedPath = locale.value === 'en' ? '/' : `/${locale.value}`
    const localized = await queryCollection('index').path(localizedPath).first()
    if (localized)
      return localized
    return await queryCollection('index').path('/').first()
  },
  { watch: [locale] },
)

if (isNil(_page.value)) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Landing Page Data not Found',
    fatal: true,
  })
}

// we tested above that these are not nil, so we can assert the types here safely by removing nil from them
const page = _page as globalThis.Ref<NonNullable<typeof _page.value>>

const seoMetadata = extractSeoMetadata(page.value)
// const { title, description } = seoMetadata

useSeoMeta({
  ...getSeoMetaBase(seoMetadata),
  ogImage: '/og-image.jpg',
  twitterImage: '/og-image.jpg',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <AppLandingBlocks v-if="page.blocks" :blocks="page.blocks" />
</template>
