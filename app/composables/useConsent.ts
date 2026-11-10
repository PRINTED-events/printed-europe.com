import type { ConsentService } from '~/utils/consent'

interface ConsentRecord {
  /** `consentSignature()` at the time of the choice. */
  v: string
  /** When the choice was made, as ISO date. */
  at: string
  /** Choice per service ID. */
  services: Record<string, boolean>
}

/**
 * The visitor's privacy choice, shared by the banner, the footer and any code
 * that loads an optional script. See `app/utils/consent.ts`.
 *
 * The choice is stored in a cookie, so the server already knows whether to
 * render the banner and it does not flash up on every page load.
 */
export function useConsent() {
  const cookie = useCookie<ConsentRecord | null>(consentCookieName, {
    default: () => null,
    maxAge: consentMaxAge,
    sameSite: 'lax',
  })
  // Kept in shared state so that every component sees a new choice at once.
  const record = useState<ConsentRecord | null>('consent-record', () => cookie.value)
  const open = useState('consent-open', () => false)

  const signature = consentSignature()
  const services: ConsentService[] = consentServices
  const hasOptional = services.length > 0

  const decided = computed(() => record.value?.v === signature)
  const visible = computed(() => open.value || !decided.value)

  function save(choices: Record<string, boolean>) {
    const next: ConsentRecord = {
      v: signature,
      at: new Date().toISOString(),
      services: Object.fromEntries(services.map(service => [service.id, choices[service.id] === true])),
    }
    cookie.value = next
    record.value = next
    open.value = false
  }

  /** Whether the visitor agreed to a service. Usable as `@nuxt/scripts` consent trigger. */
  function granted(id: string) {
    return computed(() => decided.value && record.value?.services[id] === true)
  }

  return {
    services,
    hasOptional,
    record,
    decided,
    visible,
    granted,
    save,
    acceptAll: () => save(Object.fromEntries(services.map(service => [service.id, true]))),
    rejectAll: () => save({}),
    reopen: () => { open.value = true },
  }
}
