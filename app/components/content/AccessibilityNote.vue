<script setup lang="ts">
/**
 * On-site accessibility information. Used on the tickets page and, via MDC, in
 * the FAQ location page, so that the wording only has to be maintained once.
 */

const { t } = useI18n()

// Contact details, mirroring the legal notice.
const contactEmail = 'office@printed-events.com'
const contactPhone = '+49 152 342 844 07'

// The paragraphs of the accessibility box, in display order. Each one is
// rendered through `i18n-t`, so any of them may embed the contact links.
const topics = [
  'halls',
  'route',
  'parking',
  'accompanying',
  'toilets',
  'questions',
] as const
</script>

<template>
  <UPageCard
    icon="lucide:accessibility"
    :title="t('tickets.accessibility.title')"
    :ui="{
      root: 'mt-12',
    }"
    variant="subtle"
  >
    <dl class="space-y-4 text-sm text-muted">
      <div
        v-for="topic in topics"
        :key="topic"
      >
        <dt class="inline font-semibold text-highlighted">
          {{ t(`tickets.accessibility.${topic}.label`) }}:
        </dt>
        <dd class="inline">
          <i18n-t
            :keypath="`tickets.accessibility.${topic}.text`"
            scope="global"
            tag="span"
          >
            <template #email>
              <ULink :to="`mailto:${contactEmail}`">
                {{ contactEmail }}
              </ULink>
            </template>
            <template #phone>
              <ULink :to="`tel:${contactPhone.replace(/\s/g, '')}`">
                {{ contactPhone }}
              </ULink>
            </template>
          </i18n-t>
        </dd>
      </div>
    </dl>
  </UPageCard>
</template>
