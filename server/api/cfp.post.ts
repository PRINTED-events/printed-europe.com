import process from 'node:process'

/**
 * Receives a speaker application from the form on `/cfp` and sends it by
 * e-mail through Resend (https://resend.com).
 *
 * Configured with environment variables:
 * - `NUXT_CFP_RESEND_API_KEY` (or the common `RESEND_API_KEY`): Resend API
 *   key. Without it the endpoint answers 503 and the form falls back to
 *   opening the visitor's mail program.
 * - `NUXT_CFP_MAIL_FROM`: sender, on a domain verified at Resend,
 *   e.g. `PRINTED Call for Papers <cfp@printed-europe.com>`.
 * - `NUXT_CFP_MAIL_TO`: recipient, default `office@printed-events.com`.
 */

const SPONSOR_LABELS: Record<CfpSponsorOption, string> = {
  'own-sponsor': 'Already works with a sponsor',
  'needs-sponsor': 'Looking for a sponsor',
  'no-sponsor': 'No sponsor, presents own project',
}

export default defineEventHandler(async (event) => {
  const { cfp } = useRuntimeConfig(event)
  const apiKey = cfp.resendApiKey || process.env.RESEND_API_KEY

  if (!apiKey || !cfp.mailFrom)
    throw createError({ statusCode: 503, statusMessage: 'Applications by form are not set up yet' })

  const result = cfpSchema.safeParse(await readBody(event))
  if (!result.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid application' })

  const data = result.data

  // A bot filled in the hidden field. Answer as if it worked, so it moves on.
  if (data.website)
    return { ok: true }

  await $fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from: cfp.mailFrom,
      to: [cfp.mailTo],
      reply_to: data.email,
      subject: `Call for Papers: ${data.title} – ${data.name}`,
      text: formatCfpSubmission(data, SPONSOR_LABELS[data.sponsor]),
    },
  }).catch((error) => {
    console.error('[cfp] sending the application failed', error)
    throw createError({ statusCode: 502, statusMessage: 'The application could not be sent' })
  })

  return { ok: true }
})
