import process from 'node:process'

/**
 * Receives a speaker application from the form on `/cfp` and sends it by
 * e-mail through Resend (https://resend.com): one mail to the team, and a
 * confirmation with a copy of the application to the applicant.
 *
 * Configured with environment variables:
 * - `NUXT_CFP_RESEND_API_KEY` (or the common `RESEND_API_KEY`): Resend API
 *   key. Without it the endpoint answers 503 and the form falls back to
 *   opening the visitor's mail program.
 * - `NUXT_CFP_MAIL_FROM`: sender, on a domain verified at Resend,
 *   e.g. `PRINTED Events <office@mail.printed-events.com>`.
 * - `NUXT_CFP_MAIL_TO`: recipient, default `office@printed-events.com`.
 */

type Language = 'en' | 'de'

const SPONSOR_LABELS: Record<Language, Record<CfpSponsorOption, string>> = {
  en: {
    'own-sponsor': 'Already works with a sponsor',
    'needs-sponsor': 'Looking for a sponsor',
    'no-sponsor': 'No sponsor, presents own project',
  },
  de: {
    'own-sponsor': 'Arbeitet schon mit einem Sponsor',
    'needs-sponsor': 'Sucht einen Sponsor',
    'no-sponsor': 'Kein Sponsor, stellt eigenes Projekt vor',
  },
}

const EXPERIENCE_LABELS: Record<Language, Record<CfpExperienceOption, string>> = {
  en: {
    'this-talk': 'Has given this talk before',
    'other-talks': 'Has spoken on stage, but not this talk',
    'first-time': 'First time on stage',
  },
  de: {
    'this-talk': 'Hat diesen Talk schon gehalten',
    'other-talks': 'Stand schon auf der Bühne, aber nicht mit diesem Talk',
    'first-time': 'Erstes Mal auf der Bühne',
  },
}

const FIELD_LABELS: Record<Language, CfpFieldLabels> = {
  en: cfpFieldLabels,
  de: {
    name: 'Name',
    email: 'E-Mail',
    handle: 'Creator-Handle',
    socials: 'Social Media',
    title: 'Thema',
    abstract: 'Worum es geht',
    experience: 'Bühnenerfahrung',
    lastTalk: 'Zuletzt gehalten',
    sponsor: 'Sponsor',
    notes: 'Sonstiges',
  },
}

interface Confirmation {
  subject: (title: string) => string
  text: (name: string, copy: string) => string
}

const CONFIRMATION: Record<Language, Confirmation> = {
  en: {
    subject: title => `We received your application: ${title}`,
    text: (name, copy) => [
      `Hi ${name},`,
      '',
      'thank you for applying as a speaker for the PRINTED World Conference 2027 on 21 and 22 May 2027 in Leiden. '
      + 'Your application reached us. We read every application and get back to you personally. '
      + 'Applications are open until 31 January 2027.',
      '',
      'If you want to add something, just reply to this e-mail.',
      '',
      'See you soon,',
      'the PRINTED team',
      '',
      '---',
      'Your application:',
      '',
      copy,
    ].join('\n'),
  },
  de: {
    subject: title => `Wir haben deine Bewerbung erhalten: ${title}`,
    text: (name, copy) => [
      `Hallo ${name},`,
      '',
      'danke für deine Bewerbung als Speaker für die PRINTED World Conference 2027 am 21. und 22. Mai 2027 in Leiden. '
      + 'Deine Bewerbung ist bei uns angekommen. Wir lesen jede Bewerbung und melden uns persönlich bei dir. '
      + 'Bewerbungen sind bis zum 31. Januar 2027 möglich.',
      '',
      'Wenn du noch etwas ergänzen möchtest, antworte einfach auf diese E-Mail.',
      '',
      'Bis bald,',
      'dein PRINTED-Team',
      '',
      '---',
      'Deine Bewerbung:',
      '',
      copy,
    ].join('\n'),
  },
}

function format(data: CfpSubmission, language: Language) {
  return formatCfpSubmission(data, {
    experience: EXPERIENCE_LABELS[language][data.experience],
    sponsor: SPONSOR_LABELS[language][data.sponsor],
  }, FIELD_LABELS[language])
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
    return { ok: true, confirmationSent: true }

  const language: Language = getCookie(event, 'i18n_locale') === 'de' ? 'de' : 'en'
  const confirmation = CONFIRMATION[language]

  // Both mails go out in one request: Resend limits the number of requests per
  // second, and a second request right after the first one was rejected. In
  // permissive mode a rejected mail does not stop the other one.
  // Index 0 is the application for the team, index 1 the confirmation for the
  // applicant, in the language of the website.
  const response = await $fetch<{ errors?: { index: number, message: string }[] }>(
    'https://api.resend.com/emails/batch',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'x-batch-validation': 'permissive',
      },
      body: [
        {
          from: cfp.mailFrom,
          to: [cfp.mailTo],
          reply_to: data.email,
          subject: `Call for Papers: ${data.title} – ${data.name}`,
          text: format(data, 'en'),
        },
        {
          from: cfp.mailFrom,
          to: [data.email],
          reply_to: cfp.mailTo,
          subject: confirmation.subject(data.title),
          text: confirmation.text(data.name, format(data, language)),
        },
      ],
    },
  ).catch((error) => {
    console.error('[cfp] sending the application failed', error?.data ?? error)
    throw createError({ statusCode: 502, statusMessage: 'The application could not be sent' })
  })

  const errors = response.errors ?? []
  if (errors.length)
    console.error('[cfp] Resend rejected a mail', errors)

  // Without the mail to the team the application is lost, so the visitor is told.
  if (errors.some(error => error.index === 0))
    throw createError({ statusCode: 502, statusMessage: 'The application could not be sent' })

  return { ok: true, confirmationSent: !errors.some(error => error.index === 1) }
})
