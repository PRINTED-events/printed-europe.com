<script setup lang="ts">
import { DateTime } from 'luxon'

const route = useRoute()
const appConfig = useAppConfig()
const { t } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

let slug_talk: string
try {
  slug_talk = normalizeSlug(route.params.slug)
}
catch (error) {
  throw createError({
    statusCode: 404,
    statusMessage: error instanceof Error ? error.message : 'No Talk Provided',
    fatal: true,
  })
}

const { data: talk } = await useAsyncData(route.path, () =>
  queryCollection('talks').where('slug', '=', slug_talk).first())

if (!talk.value) {
  throw createError({
    statusCode: 404,
    statusMessage: `Talk "${slug_talk}" not Found`,
    fatal: true,
  })
}

const slug_stage = talk.value.stage
const slug_speakers = talk.value.speakers

const [
  { data: stage },
  { data: speakers },
] = await Promise.all([
  useAsyncData(`${route.path}-stage`, () => queryCollection('stages').where('slug', '=', slug_stage).first()),
  useAsyncData(`${route.path}-speakers`, () => queryCollection('speakers').where('slug', 'IN', slug_speakers).all()),
])

function formatDateTime(dateTimeStr?: string): string {
  if (!dateTimeStr)
    return t('talkDetail.dateTimeTba')

  const date = DateTime.fromISO(dateTimeStr, {
    zone: appConfig.general.timeZone || 'UTC',
  })
  if (!date.isValid) {
    return t('talkDetail.dateTimeTba')
  }

  const day = date.toISODate()
  const time = date.toLocaleString(DateTime.TIME_24_SIMPLE)
  const timeZone = date.zoneName

  return t('talkDetail.dateAt', { day, time, timeZone })
}

const seoMetadata = extractSeoMetadata(talk.value)
// const { title, description } = seoMetadata

useSeoMeta({
  ...getSeoMetaBase(seoMetadata),
})

defineOgImageComponent('DefaultSatori', {
  headline: t('talkDetail.ogHeadline'),
  title: seoMetadata.title,
  description: speakers.value?.length
    ? t('talkDetail.presentedBy', { names: speakers.value.map(s => s.name).join(', ') })
    : undefined,
})
</script>

<template>
  <template v-if="talk">
    <UContainer class="pt-3 pb-8">
      <UBreadcrumb
        :items="[
          { label: t('common.home'), to: '/' },
          { label: t('schedule.title'), to: '/schedule' },
          { label: talk.title },
        ]"
      />

      <UPageBody>
        <UPageHeader
          :headline="t('talkDetail.headline')"
          :title="talk.title"
        />

        <div class="flex flex-col gap-2 max-w-sm -mt-5">
          <div class="flex items-center text-muted">
            <UIcon class="mr-2 size-5" name="lucide:tag" />
            <span>{{ talk.type }}</span>
          </div>

          <ULink class="flex items-center" to="/schedule">
            <UIcon class="mr-2 size-5" name="lucide:calendar" />
            <span>{{ formatDateTime(talk.dateTime) }}</span>
          </ULink>

          <ULink v-if="stage" class="flex items-center" to="/faq/location">
            <UIcon class="mr-2 size-5" name="lucide:map-pin" />
            <span>{{ stage.name }}</span>
          </ULink>
        </div>

        <!-- description -->
        <p v-if="talk.description" class="text-muted text-base leading-relaxed max-w-2xl">
          {{ talk.description }}
        </p>

        <!-- talk details -->
        <div class="prose dark:prose-invert">
          <ContentRenderer v-if="talk.body" :value="talk" />
        </div>

        <!-- resources -->
        <div v-if="talk.resources?.length">
          <ProseH2>
            {{ t('talkDetail.resources') }}
          </ProseH2>
          <div class="flex flex-wrap gap-3">
            <UButton
              v-for="resource in talk.resources"
              :key="resource.url"
              color="neutral"
              :icon="resource.icon || getIconForUrl(resource.url)"
              :label="resource.description || t('common.resource')"
              target="_blank"
              :to="resource.url"
              variant="subtle"
            />
          </div>
        </div>

        <!-- speakers -->
        <div>
          <ProseH2>
            {{ t('talkDetail.speakers') }}
          </ProseH2>
          <template v-if="speakers && speakers.length > 0">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12">
              <AppSpeakerCard
                v-for="speaker in speakers"
                :key="speaker.slug"
                :speaker="speaker"
              />
            </div>
          </template>
          <template v-else>
            <UAlert
              color="neutral"
              :description="t('talkDetail.noSpeakers')"
              icon="lucide:info"
              variant="subtle"
            />
          </template>
        </div>
      </UPageBody>
    </UContainer>
  </template>
</template>
