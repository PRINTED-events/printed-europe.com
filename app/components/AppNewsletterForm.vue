<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

// Newsletter sign-up form, sent to HubSpot through `/api/newsletter`.
// `compact` puts the fields in one row on wide screens, for the band above the footer.
const props = defineProps<{
  compact?: boolean
}>()

const { t } = useI18n()
const id = useId()

const state = reactive<Partial<NewsletterSubmission>>({
  firstName: '',
  email: '',
  consent: undefined,
  website: '',
})

const status = ref<'idle' | 'sending' | 'sent' | 'error' | 'unavailable' | 'invalid' | 'tooMany'>('idle')

function validate(data: Partial<NewsletterSubmission>) {
  const result = newsletterSchema.safeParse(data)
  if (result.success)
    return []
  return result.error.issues.map(issue => ({
    name: issue.path.join('.'),
    message: t(`newsletter.errors.${issue.message}`),
  }))
}

async function onSubmit(event: FormSubmitEvent<NewsletterSubmission>) {
  status.value = 'sending'
  try {
    await $fetch('/api/newsletter', {
      method: 'POST',
      body: { ...event.data, consentText: t('newsletter.consent', { privacy: t('newsletter.privacy') }) },
    })
    status.value = 'sent'
  }
  catch (error) {
    const code = (error as { statusCode?: number }).statusCode
    status.value = code === 503 ? 'unavailable' : code === 400 ? 'invalid' : code === 429 ? 'tooMany' : 'error'
  }
}

const fieldsClass = computed(() => props.compact
  ? 'grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-start'
  : 'grid gap-4 sm:grid-cols-2')

const statusMessage = computed(() => ['error', 'unavailable', 'invalid', 'tooMany'].includes(status.value)
  ? t(`newsletter.status.${status.value}`)
  : undefined)
</script>

<template>
  <div>
    <div v-if="status === 'sent'" class="flex gap-3 rounded-lg border border-primary/40 bg-primary/10 p-5">
      <UIcon class="mt-0.5 size-5 shrink-0 text-primary" name="i-lucide-mail-check" />
      <div>
        <p class="font-semibold text-highlighted">
          {{ t('newsletter.sent.title') }}
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ t('newsletter.sent.description') }}
        </p>
      </div>
    </div>

    <UForm
      v-else
      class="space-y-4"
      :state="state"
      :validate="validate"
      :validate-on="['blur']"
      @submit="onSubmit"
    >
      <div :class="fieldsClass">
        <UFormField
          :label="t('newsletter.fields.firstName')"
          name="firstName"
          :ui="props.compact ? { label: 'sr-only' } : undefined"
        >
          <UInput
            v-model="state.firstName"
            autocomplete="given-name"
            class="w-full"
            :placeholder="props.compact ? t('newsletter.fields.firstName') : undefined"
            size="lg"
          />
        </UFormField>

        <UFormField
          :label="t('newsletter.fields.email')"
          name="email"
          :ui="props.compact ? { label: 'sr-only' } : undefined"
        >
          <UInput
            v-model="state.email"
            autocomplete="email"
            class="w-full"
            :placeholder="props.compact ? t('newsletter.fields.email') : undefined"
            size="lg"
            type="email"
          />
        </UFormField>

        <UButton
          v-if="props.compact"
          class="hidden sm:inline-flex justify-center"
          :label="t('newsletter.submit')"
          :loading="status === 'sending'"
          size="lg"
          type="submit"
        />
      </div>

      <!-- Honeypot for spam bots, hidden from people and screen readers. -->
      <div aria-hidden="true" class="absolute -left-[9999px]">
        <label :for="`${id}-website`">Website</label>
        <input
          :id="`${id}-website`"
          v-model="state.website"
          autocomplete="off"
          name="website"
          tabindex="-1"
          type="text"
        >
      </div>

      <UFormField name="consent">
        <UCheckbox v-model="state.consent" :ui="{ label: 'text-sm font-normal text-muted' }">
          <template #label>
            <i18n-t keypath="newsletter.consent" scope="global">
              <template #privacy>
                <ULink class="text-primary underline" target="_blank" to="/privacy-policy">
                  {{ t('newsletter.privacy') }}
                </ULink>
              </template>
            </i18n-t>
          </template>
        </UCheckbox>
      </UFormField>

      <p v-if="statusMessage" class="text-sm text-error" role="alert">
        {{ statusMessage }}
      </p>

      <UButton
        :class="props.compact ? 'w-full justify-center sm:hidden' : undefined"
        :icon="props.compact ? undefined : 'i-lucide-mail'"
        :label="t('newsletter.submit')"
        :loading="status === 'sending'"
        :size="props.compact ? 'lg' : 'xl'"
        type="submit"
      />
    </UForm>
  </div>
</template>
