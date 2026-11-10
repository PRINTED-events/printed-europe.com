import { z } from 'zod/v4'

/**
 * Newsletter sign-up: the fields of the form, shared by `AppNewsletterForm`
 * and the endpoint `/api/newsletter`. Error messages are translation keys
 * below `newsletter.errors`.
 */
export const newsletterSchema = z.object({
  firstName: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  email: z.email('email').max(200, 'tooLong'),
  consent: z.literal(true, 'consent'),
  // The consent text exactly as shown, stored with the consent in HubSpot.
  consentText: z.string().max(500).optional(),
  // Honeypot: hidden from people, filled in by spam bots.
  website: z.string().max(0).optional(),
})

export type NewsletterSubmission = z.output<typeof newsletterSchema>
