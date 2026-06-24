<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

const allEvents = computed(() => [
  {
    label: 'PRINTED Hub',
    description: 'Sep 2025 · Rüdesheim',
    to: 'https://hub25.printed-europe.com',
    target: '_blank',
  },
  {
    label: 'PRINTED Worldconference',
    description: 'May 2025 · Amsterdam',
    to: 'https://pwc25.printed-europe.com',
    target: '_blank',
  },
  {
    label: 'PRINTED Worldconference',
    description: `May 2027 · Amsterdam – ${t('common.comingSoon')}`,
    disabled: true,
  },
  {
    label: t('header.aboutPrintedEvents'),
    to: 'https://printed-events.com',
    target: '_blank',
  },
])

const items = computed(() => [
  {
    label: t('nav.schedule'),
    to: '/schedule',
    active: route.path.startsWith('/schedule') || route.path.startsWith('/talks'),
  },
  {
    label: t('nav.speakers'),
    to: '/speakers',
    active: route.path.startsWith('/speakers'),
  },
  {
    label: t('nav.location'),
    to: '/faq/location',
    active: route.path.startsWith('/faq/location'),
  },
  {
    label: t('nav.faq'),
    to: '/faq',
    active: route.path.startsWith('/faq'),
  },
  {
    label: t('nav.events'),
    children: allEvents.value,
  },
])
</script>

<template>
  <UHeader mode="slideover">
    <template #left>
      <ULink
        :aria-label="t('header.homeAria')"
        class="mr-0 md:mr-8"
        to="/"
      >
        <AppLogo class="w-auto h-6 shrink-0" />
      </ULink>

      <UNavigationMenu
        class="hidden lg:inline-flex"
        content-orientation="vertical"
        :items="items"
        variant="link"
      />
    </template>

    <template #right>
      <AppLanguageSwitcher />

      <UButton
        :aria-label="t('header.buyTicketsAria')"
        class="lg:hidden"
        color="neutral"
        icon="i-lucide-ticket"
        :title="t('header.buyTicketsAria')"
        to="/tickets"
        variant="ghost"
      />

      <UButton
        class="hidden lg:inline-flex"
        color="primary"
        :label="t('header.applyAsSpeaker')"
        to="/faq/cfp"
        variant="outline"
      />

      <UButton
        class="hidden lg:inline-flex"
        color="primary"
        :label="t('header.buyTickets')"
        to="/tickets"
        variant="solid"
      />
    </template>

    <template #body>
      <UNavigationMenu
        class="-mx-2.5"
        :items="items"
        orientation="vertical"
      />

      <USeparator class="my-6" />

      <UButton
        block
        class="mb-3"
        color="primary"
        :label="t('header.buyTickets')"
        to="/tickets"
      />

      <UButton
        block
        class="mb-3"
        color="primary"
        :label="t('header.applyAsSpeaker')"
        to="/faq/cfp"
        variant="subtle"
      />

      <AppLanguageSwitcher class="mt-3" />
    </template>
  </UHeader>
</template>

