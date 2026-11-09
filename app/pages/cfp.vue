<script setup lang="ts">
import type { FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'

const { t } = useI18n()
const { extractSeoMetadata, getSeoMetaBase } = useSeo()

const seoMetadata = computed(() => extractSeoMetadata({
  title: t('cfp.seoTitle'),
  description: t('cfp.seoDescription'),
}))

const meta = computed(() => getSeoMetaBase(seoMetadata.value))

useSeoMeta({
  title: () => meta.value.title,
  ogTitle: () => meta.value.ogTitle,
  description: () => meta.value.description,
  ogDescription: () => meta.value.ogDescription,
})

defineOgImageComponent('DefaultSatori', {
  headline: t('cfp.headline'),
  title: t('cfp.title'),
  description: t('cfp.seoDescription'),
})

const state = reactive<Partial<CfpSubmission>>({
  name: '',
  email: '',
  handle: '',
  socials: '',
  title: '',
  abstract: '',
  experience: undefined,
  lastTalk: '',
  sponsor: undefined,
  sponsorName: '',
  notes: '',
  consent: undefined,
  website: '',
})

const experienceItems = computed(() => cfpExperienceOptions.map(value => ({
  value,
  label: t(`cfp.experience.${value}`),
})))

const sponsorItems = computed(() => cfpSponsorOptions.map(value => ({
  value,
  label: t(`cfp.sponsor.${value}.label`),
  description: t(`cfp.sponsor.${value}.description`),
})))

// The schema returns translation keys as messages, so the form shows them in the current language.
function validate(data: Partial<CfpSubmission>) {
  const result = cfpSchema.safeParse(data)
  if (result.success)
    return []
  return result.error.issues.map(issue => ({
    name: issue.path.join('.'),
    message: t(`cfp.errors.${issue.message}`),
  }))
}

const status = ref<'idle' | 'sending' | 'sent' | 'mail' | 'error'>('idle')
const confirmationSent = ref(true)
const mailtoHref = ref('')

function onError(event: FormErrorEvent) {
  const id = event.errors[0]?.id
  if (id)
    document.getElementById(id)?.focus()
}

async function onSubmit(event: FormSubmitEvent<CfpSubmission>) {
  status.value = 'sending'
  try {
    const response = await $fetch('/api/cfp', { method: 'POST', body: event.data })
    confirmationSent.value = response.confirmationSent !== false
    status.value = 'sent'
  }
  catch (error) {
    // The form is not connected to a mail service yet: hand the application to the visitor's mail program.
    if ((error as { statusCode?: number }).statusCode === 503) {
      const body = formatCfpSubmission(event.data, {
        experience: t(`cfp.experience.${event.data.experience}`),
        sponsor: t(`cfp.sponsor.${event.data.sponsor}.label`),
      })
      const subject = encodeURIComponent(`Call for Papers: ${event.data.title} – ${event.data.name}`)
      mailtoHref.value = `mailto:${cfpContactEmail}?subject=${subject}&body=${encodeURIComponent(body)}`
      status.value = 'mail'
      window.location.href = mailtoHref.value
      return
    }
    status.value = 'error'
  }
}
</script>

<template>
  <UContainer class="pt-3 pb-16">
    <UBreadcrumb
      :items="[
        { label: t('common.home'), to: '/' },
        { label: t('cfp.breadcrumb') },
      ]"
    />

    <div class="mt-8 grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
      <div>
        <AppLandingBlockHead
          :description="t('cfp.intro')"
          :headline="t('cfp.headline')"
          :title="t('cfp.title')"
        />

        <ul class="mt-8 space-y-4">
          <li
            v-for="key in ['deadline', 'stage', 'recording', 'reply']"
            :key="key"
            class="flex gap-3"
          >
            <UIcon
              class="mt-1 size-5 shrink-0 text-primary"
              :name="key === 'deadline' ? 'i-lucide-calendar-clock' : 'i-lucide-check'"
            />
            <span :class="key === 'deadline' ? 'font-semibold text-highlighted' : 'text-muted'">
              {{ t(`cfp.facts.${key}`) }}
            </span>
          </li>
        </ul>

        <p class="mt-8 text-sm text-muted">
          <i18n-t keypath="cfp.questions" scope="global">
            <template #email>
              <ULink class="text-primary underline" :to="`mailto:${cfpContactEmail}`">
                {{ cfpContactEmail }}
              </ULink>
            </template>
          </i18n-t>
        </p>
      </div>

      <div>
        <UPageCard
          v-if="status === 'sent'"
          :description="t(confirmationSent ? 'cfp.sent.description' : 'cfp.sent.noConfirmation')"
          icon="i-lucide-party-popper"
          :title="t('cfp.sent.title')"
          variant="subtle"
        />

        <UPageCard
          v-else-if="status === 'mail'"
          :description="t('cfp.mail.description', { email: cfpContactEmail })"
          icon="i-lucide-mail"
          :title="t('cfp.mail.title')"
          variant="subtle"
        >
          <div class="flex flex-wrap gap-3">
            <UButton :label="t('cfp.mail.open')" :to="mailtoHref" />
            <UButton
              color="neutral"
              :label="t('cfp.mail.back')"
              variant="outline"
              @click="status = 'idle'"
            />
          </div>
        </UPageCard>

        <UForm
          v-else
          class="space-y-6 rounded-lg border border-default bg-muted p-6 sm:p-8"
          :state="state"
          :validate="validate"
          :validate-on="['blur', 'change']"
          @error="onError"
          @submit="onSubmit"
        >
          <fieldset class="space-y-5">
            <legend class="mb-4 text-lg font-bold text-highlighted">
              {{ t('cfp.sections.you') }}
            </legend>

            <div class="grid gap-5 sm:grid-cols-2">
              <UFormField :label="t('cfp.fields.name')" name="name" required>
                <UInput v-model="state.name" autocomplete="name" class="w-full" />
              </UFormField>

              <UFormField :label="t('cfp.fields.email')" name="email" required>
                <UInput
                  v-model="state.email"
                  autocomplete="email"
                  class="w-full"
                  type="email"
                />
              </UFormField>
            </div>

            <UFormField
              :hint="t('cfp.optional')"
              :label="t('cfp.fields.handle')"
              name="handle"
            >
              <UInput v-model="state.handle" class="w-full" :placeholder="t('cfp.placeholders.handle')" />
            </UFormField>

            <UFormField
              :help="t('cfp.help.socials')"
              :hint="t('cfp.optional')"
              :label="t('cfp.fields.socials')"
              name="socials"
            >
              <UTextarea
                v-model="state.socials"
                autoresize
                class="w-full"
                :placeholder="t('cfp.placeholders.socials')"
                :rows="3"
              />
            </UFormField>
          </fieldset>

          <USeparator />

          <fieldset class="space-y-5">
            <legend class="mb-4 text-lg font-bold text-highlighted">
              {{ t('cfp.sections.talk') }}
            </legend>

            <UFormField :label="t('cfp.fields.title')" name="title" required>
              <UInput v-model="state.title" class="w-full" />
            </UFormField>

            <UFormField
              :help="t('cfp.help.abstract')"
              :label="t('cfp.fields.abstract')"
              name="abstract"
              required
            >
              <UTextarea
                v-model="state.abstract"
                autoresize
                class="w-full"
                :rows="6"
              />
            </UFormField>

            <UFormField :label="t('cfp.fields.experience')" name="experience" required>
              <URadioGroup
                v-model="state.experience"
                class="mt-1"
                :items="experienceItems"
              />
            </UFormField>

            <UFormField
              v-if="state.experience && state.experience !== 'first-time'"
              :help="t('cfp.help.lastTalk')"
              :label="t('cfp.fields.lastTalk')"
              name="lastTalk"
              required
            >
              <UInput v-model="state.lastTalk" class="w-full" />
            </UFormField>
          </fieldset>

          <USeparator />

          <fieldset class="space-y-5">
            <legend class="mb-4 text-lg font-bold text-highlighted">
              {{ t('cfp.sections.sponsor') }}
            </legend>

            <UFormField name="sponsor">
              <URadioGroup
                v-model="state.sponsor"
                :items="sponsorItems"
                variant="card"
              />
            </UFormField>

            <UFormField
              v-if="state.sponsor === 'own-sponsor'"
              :label="t('cfp.fields.sponsorName')"
              name="sponsorName"
              required
            >
              <UInput v-model="state.sponsorName" class="w-full" />
            </UFormField>
          </fieldset>

          <USeparator />

          <UFormField
            :hint="t('cfp.optional')"
            :label="t('cfp.fields.notes')"
            name="notes"
          >
            <UTextarea
              v-model="state.notes"
              autoresize
              class="w-full"
              :rows="3"
            />
          </UFormField>

          <!-- Honeypot for spam bots, hidden from people and screen readers. -->
          <div aria-hidden="true" class="absolute -left-[9999px]">
            <label for="cfp-website">Website</label>
            <input
              id="cfp-website"
              v-model="state.website"
              autocomplete="off"
              name="website"
              tabindex="-1"
              type="text"
            >
          </div>

          <UFormField name="consent">
            <UCheckbox v-model="state.consent">
              <template #label>
                <i18n-t keypath="cfp.fields.consent" scope="global">
                  <template #privacy>
                    <ULink class="text-primary underline" target="_blank" to="/privacy-policy">
                      {{ t('cfp.privacy') }}
                    </ULink>
                  </template>
                </i18n-t>
              </template>
            </UCheckbox>
          </UFormField>

          <UAlert
            v-if="status === 'error'"
            color="error"
            :description="t('cfp.failed.description', { email: cfpContactEmail })"
            icon="i-lucide-circle-alert"
            :title="t('cfp.failed.title')"
            variant="subtle"
          />

          <UButton
            icon="i-lucide-send"
            :label="t('cfp.submit')"
            :loading="status === 'sending'"
            size="xl"
            type="submit"
          />
        </UForm>
      </div>
    </div>
  </UContainer>
</template>
