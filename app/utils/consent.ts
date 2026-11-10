/**
 * Optional services that may only run after the visitor agrees, such as
 * advertising or analytics (Google Ads, Meta Pixel, ...).
 *
 * As long as this list is empty, the privacy banner only tells visitors that
 * nothing is tracked and offers a single "Got it" button. As soon as a service
 * is listed here, the banner turns into a consent banner with "Accept all",
 * "Reject all" and one checkbox per service, and everyone sees it again (the
 * stored choice is tied to the list of service IDs).
 *
 * Adding a service:
 * 1. Add an entry below, e.g. `{ id: 'google-ads' }`.
 * 2. Add `consent.services.<id>.title` and `.description` to both locale files.
 * 3. Load its script only with consent, e.g. with `@nuxt/scripts`:
 *      const { granted } = useConsent()
 *      useScriptGoogleTagManager({
 *        id: 'GTM-XXXXXXX',
 *        scriptOptions: { trigger: useScriptTriggerConsent({ consent: granted('google-ads') }) },
 *      })
 * 4. Describe the service in `content/pages/privacy-policy.md`.
 */
export interface ConsentService {
  id: string
}

export const consentServices: ConsentService[] = []

/** Name of the cookie that stores the visitor's choice. */
export const consentCookieName = 'privacy_consent'

/** How long the choice is kept before the banner is shown again (180 days). */
export const consentMaxAge = 60 * 60 * 24 * 180

/**
 * Identifies the set of services a stored choice refers to. When services are
 * added or removed, older choices no longer match and the banner shows again.
 */
export function consentSignature(services: ConsentService[] = consentServices) {
  return ['v1', ...services.map(service => service.id).sort()].join(':')
}
