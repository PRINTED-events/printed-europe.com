import { z } from 'zod/v4'

/**
 * Call for papers: the fields of the speaker application form.
 *
 * Shared by the form on `/cfp` and the endpoint `/api/cfp`, so both check the
 * same rules. Error messages are translation keys below `cfp.errors`.
 */

/**
 * The call for papers closes at the end of 31 January 2027, Amsterdam time.
 * From then on the form, the homepage callout and the header button are gone.
 */
export const cfpClosesAt = '2027-02-01T00:00:00+01:00'

export function isCfpOpen(now = new Date()): boolean {
  return now < new Date(cfpClosesAt)
}

/** Where applications go when the form cannot send them itself. */
export const cfpContactEmail = 'office@printed-events.com'

export const cfpSponsorOptions = ['own-sponsor', 'needs-sponsor', 'no-sponsor'] as const

export type CfpSponsorOption = typeof cfpSponsorOptions[number]

export const cfpExperienceOptions = ['this-talk', 'other-talks', 'first-time'] as const

export type CfpExperienceOption = typeof cfpExperienceOptions[number]

export const cfpSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  email: z.email('email').max(200, 'tooLong'),
  handle: z.string().trim().max(120, 'tooLong').optional(),
  socials: z.string().trim().max(1000, 'tooLong').optional(),
  title: z.string().trim().min(1, 'required').max(160, 'tooLong'),
  abstract: z.string().trim().min(30, 'tooShort').max(3000, 'tooLong'),
  experience: z.enum(cfpExperienceOptions, 'required'),
  lastTalk: z.string().trim().max(300, 'tooLong').optional(),
  sponsor: z.enum(cfpSponsorOptions, 'required'),
  sponsorName: z.string().trim().max(160, 'tooLong').optional(),
  notes: z.string().trim().max(2000, 'tooLong').optional(),
  consent: z.literal(true, 'consent'),
  // Honeypot: hidden from people, filled in by spam bots.
  website: z.string().max(0).optional(),
}).refine(
  data => data.experience === 'first-time' || Boolean(data.lastTalk),
  { path: ['lastTalk'], message: 'required' },
).refine(
  data => data.sponsor !== 'own-sponsor' || Boolean(data.sponsorName),
  { path: ['sponsorName'], message: 'required' },
)

export type CfpSubmission = z.output<typeof cfpSchema>

/** Field names in the plain text version of an application. */
export const cfpFieldLabels = {
  name: 'Name',
  email: 'E-mail',
  handle: 'Creator handle',
  socials: 'Social media',
  title: 'Talk title',
  abstract: 'About the talk',
  experience: 'Stage experience',
  lastTalk: 'Last given at',
  sponsor: 'Sponsor',
  notes: 'Anything else',
}

export type CfpFieldLabels = typeof cfpFieldLabels

/** Plain text version of an application, used for the e-mails. */
export function formatCfpSubmission(
  data: CfpSubmission,
  labels: { experience: string, sponsor: string },
  fields: CfpFieldLabels = cfpFieldLabels,
): string {
  return [
    `${fields.name}: ${data.name}`,
    `${fields.email}: ${data.email}`,
    `${fields.handle}: ${data.handle || '–'}`,
    `${fields.socials}:\n${data.socials || '–'}`,
    '',
    `${fields.title}: ${data.title}`,
    `${fields.abstract}:\n${data.abstract}`,
    '',
    `${fields.experience}: ${labels.experience}`,
    ...(data.experience === 'first-time' ? [] : [`${fields.lastTalk}: ${data.lastTalk || '–'}`]),
    '',
    `${fields.sponsor}: ${labels.sponsor}${data.sponsorName ? ` (${data.sponsorName})` : ''}`,
    '',
    `${fields.notes}:\n${data.notes || '–'}`,
  ].join('\n')
}
