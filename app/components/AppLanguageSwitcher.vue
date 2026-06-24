<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { LOCALE_COOKIE_KEY } from '~/utils/i18n'

const { locale, locales, setLocale } = useI18n()

// Persist the manual choice ourselves: browser-language detection is disabled
// (default stays English), so the cookie is what survives a hard reload.
const localeCookie = useCookie<string>(LOCALE_COOKIE_KEY, {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
})

const currentLocale = computed(() =>
  locales.value.find(l => l.code === locale.value),
)

const items = computed<DropdownMenuItem[]>(() =>
  locales.value.map(l => ({
    label: l.name ?? l.code,
    icon: l.code === locale.value ? 'i-lucide-check' : undefined,
    onSelect: () => {
      localeCookie.value = l.code
      setLocale(l.code)
    },
  })),
)
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      :aria-label="currentLocale?.name ?? locale"
      color="neutral"
      icon="i-lucide-globe"
      :label="locale.toUpperCase()"
      size="sm"
      variant="ghost"
    />
  </UDropdownMenu>
</template>
