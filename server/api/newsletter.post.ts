/**
 * Signs a visitor up for the newsletter by submitting the HubSpot form behind
 * it through HubSpot's Forms Submission API. HubSpot then handles the contact,
 * the consent, the subscription type and the double opt-in mail, exactly as
 * for its own embedded form. No HubSpot script runs in the visitor's browser.
 *
 * Configured in `runtimeConfig.newsletter` in `nuxt.config.ts`, each value can
 * be overridden with an environment variable (the IDs are not secret, they are
 * part of every HubSpot embed code):
 * - `NUXT_NEWSLETTER_HUBSPOT_PORTAL_ID`: the HubSpot account ("portal") ID.
 * - `NUXT_NEWSLETTER_HUBSPOT_FORM_ID`: the ID of the newsletter form.
 * - `NUXT_NEWSLETTER_HUBSPOT_SUBSCRIPTION_TYPE_ID`: optional, the subscription
 *   type the visitor agrees to. Needed when the form uses GDPR consent.
 * - `NUXT_NEWSLETTER_HUBSPOT_API_BASE`: optional, default `https://api-eu1.hsforms.com`.
 *
 * Without portal and form ID the endpoint answers 503.
 */

interface HubSpotError {
  errors?: { errorType?: string, message?: string }[]
}

export default defineEventHandler(async (event) => {
  const { newsletter } = useRuntimeConfig(event)

  if (!newsletter.hubspotPortalId || !newsletter.hubspotFormId)
    throw createError({ statusCode: 503, statusMessage: 'The newsletter sign-up is not connected yet' })

  if (!checkRateLimit(event, 'newsletter', 5, 60 * 60 * 1000))
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-ups, please try again later' })

  const result = newsletterSchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid sign-up' })

  const data = result.data

  // A bot filled in the hidden field. Answer as if it worked, so it moves on.
  if (data.website)
    return { ok: true }

  const consentText = data.consentText || 'I would like to receive the PRINTED newsletter.'
  const subscriptionTypeId = Number(newsletter.hubspotSubscriptionTypeId)
  const referer = getRequestHeader(event, 'referer')

  const { hubspotApiBase, hubspotPortalId, hubspotFormId } = newsletter
  await $fetch(
    `${hubspotApiBase}/submissions/v3/integration/submit/${hubspotPortalId}/${hubspotFormId}`,
    {
      method: 'POST',
      body: {
        submittedAt: Date.now(),
        fields: [
          { objectTypeId: '0-1', name: 'email', value: data.email },
          { objectTypeId: '0-1', name: 'firstname', value: data.firstName },
        ],
        context: {
          pageUri: referer,
          pageName: 'printed-europe.com',
        },
        legalConsentOptions: {
          consent: {
            consentToProcess: true,
            text: consentText,
            communications: subscriptionTypeId
              ? [{ value: true, subscriptionTypeId, text: consentText }]
              : [],
          },
        },
      },
    },
  ).catch((error) => {
    const details = (error?.data ?? {}) as HubSpotError
    console.error('[newsletter] HubSpot rejected the sign-up', details.errors ?? error)
    if (details.errors?.some(item => item.errorType === 'INVALID_EMAIL'))
      throw createError({ statusCode: 400, statusMessage: 'Invalid e-mail address' })
    throw createError({ statusCode: 502, statusMessage: 'The sign-up could not be sent' })
  })

  return { ok: true }
})
