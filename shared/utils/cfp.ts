import { z } from 'zod/v4'

/**
 * Call for papers: the fields of the speaker application form.
 *
 * Shared by the form on `/cfp` and the endpoint `/api/cfp`, so both check the
 * same rules. Error messages are translation keys below `cfp.errors`.
 */

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

/** Plain text version of an application, used for the e-mail. */
export function formatCfpSubmission(data: CfpSubmission, labels: { experience: string, sponsor: string }): string {
  return [
    `Name: ${data.name}`,
    `E-mail: ${data.email}`,
    `Creator handle: ${data.handle || '–'}`,
    `Social media:\n${data.socials || '–'}`,
    '',
    `Talk title: ${data.title}`,
    `About the talk:\n${data.abstract}`,
    '',
    `Stage experience: ${labels.experience}`,
    ...(data.experience === 'first-time' ? [] : [`Last given at: ${data.lastTalk || '–'}`]),
    '',
    `Sponsor: ${labels.sponsor}${data.sponsorName ? ` (${data.sponsorName})` : ''}`,
    '',
    `Anything else:\n${data.notes || '–'}`,
  ].join('\n')
}
