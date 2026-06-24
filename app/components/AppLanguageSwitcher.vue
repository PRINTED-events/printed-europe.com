<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { locale, locales, setLocale } = useI18n()

const currentLocale = computed(() =>
  locales.value.find(l => l.code === locale.value),
)

const items = computed<DropdownMenuItem[]>(() =>
  locales.value.map(l => ({
    label: l.name ?? l.code,
    icon: l.code === locale.value ? 'i-lucide-check' : undefined,
    onSelect: () => {
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
      icon="i-lucide-languages"
      :label="locale.toUpperCase()"
      size="sm"
      variant="ghost"
    />
  </UDropdownMenu>
</template>
