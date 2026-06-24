<script setup lang="ts">
import { de as uiDe, en as uiEn } from '@nuxt/ui/locale'

const colorMode = useColorMode()
const appConfig = useAppConfig()
const { autoSwitchOnColorMode } = useImgPaths()
const { locale } = useI18n()

const color = computed(() => colorMode.value === 'dark' ? '#020618' : '#ffffff')

// Map the active i18n locale to the matching `@nuxt/ui` locale so built-in
// component strings (search, pagination, etc.) follow the selected language.
const uiLocale = computed(() => locale.value === 'de' ? uiDe : uiEn)

useHead(() => ({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
  link: [
    {
      rel: 'icon',
      // href: '/assets/favicon.svg',
      href: autoSwitchOnColorMode({
        dark: appConfig.general?.favicon?.dark,
        light: appConfig.general?.favicon?.light,
      }),
    },
  ],
  htmlAttrs: {
    lang: locale.value,
  },
}))

useSeoMeta({
  // titleTemplate: '%s',
  // TODO
  // ogImage: '',
  // twitterImage: '',
  // twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtRouteAnnouncer />
    <UToaster />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
