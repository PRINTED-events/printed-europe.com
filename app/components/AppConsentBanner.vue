<script setup lang="ts">
// Privacy banner at the bottom of the page. Without optional services (see
// `app/utils/consent.ts`) it only says that nothing is tracked; with services
// it asks for consent, with "reject" as prominent as "accept".
const { t } = useI18n()
const { services, hasOptional, record, visible, save, acceptAll, rejectAll } = useConsent()

const choices = reactive<Record<string, boolean>>({})
watch(visible, (isVisible) => {
  if (!isVisible)
    return
  for (const service of services)
    choices[service.id] = record.value?.services[service.id] === true
}, { immediate: true })
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="translate-y-4 opacity-0"
  >
    <aside
      v-if="visible"
      :aria-label="t('consent.label')"
      class="fixed inset-x-4 bottom-4 z-50 rounded-lg border border-default bg-default/95 p-5 shadow-xl
      backdrop-blur sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-md"
    >
      <div class="flex gap-3">
        <UIcon class="mt-0.5 size-5 shrink-0 text-primary" name="i-lucide-shield-check" />
        <div>
          <p class="font-semibold text-highlighted">
            {{ hasOptional ? t('consent.choice.title') : t('consent.info.title') }}
          </p>
          <p class="mt-1 text-sm text-muted">
            <i18n-t :keypath="hasOptional ? 'consent.choice.description' : 'consent.info.description'" scope="global">
              <template #privacy>
                <ULink class="text-primary underline" to="/privacy-policy">
                  {{ t('consent.privacy') }}
                </ULink>
              </template>
            </i18n-t>
          </p>
        </div>
      </div>

      <div v-if="hasOptional" class="mt-4 space-y-3">
        <UCheckbox
          v-for="service in services"
          :key="service.id"
          v-model="choices[service.id]"
          :description="t(`consent.services.${service.id}.description`)"
          :label="t(`consent.services.${service.id}.title`)"
        />
      </div>

      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <template v-if="hasOptional">
          <UButton
            color="neutral"
            :label="t('consent.choice.save')"
            variant="ghost"
            @click="save(choices)"
          />
          <UButton :label="t('consent.choice.rejectAll')" @click="rejectAll" />
          <UButton :label="t('consent.choice.acceptAll')" @click="acceptAll" />
        </template>
        <UButton
          v-else
          :label="t('consent.info.acknowledge')"
          @click="save({})"
        />
      </div>
    </aside>
  </Transition>
</template>
