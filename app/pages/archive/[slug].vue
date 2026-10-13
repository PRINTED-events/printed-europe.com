<script setup lang="ts">
import { isNil } from 'lodash-es'

// Recap of a past event, e.g. `/archive/hub26`. The content lives in
// `content/archive/<slug>.yml` and uses the same blocks as the homepage.
const route = useRoute()
const { locale } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const slug = computed(() => String(route.params.slug))

const { data: _page } = await useAsyncData(
  () => `archive-${slug.value}`,
  async () => {
    // Load the recap for the active locale; fall back to the default locale
    // if a localized variant does not exist yet.
    const basePath = `/archive/${slug.value}`
    if (locale.value !== 'en') {
      const localized = await queryCollection('archive').path(`/${locale.value}${basePath}`).first()
      if (localized)
        return localized
    }
    return await queryCollection('archive').path(basePath).first()
  },
  { watch: [locale] },
)

if (isNil(_page.value)) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true,
  })
}

// we tested above that these are not nil, so we can assert the types here safely by removing nil from them
const page = _page as globalThis.Ref<NonNullable<typeof _page.value>>

useSeoMeta(getSeoMetaBase(extractSeoMetadata(page.value)))
</script>

<template>
  <AppLandingBlocks :blocks="page.blocks" />
</template>
