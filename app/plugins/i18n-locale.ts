import type { Ref } from 'vue'
import { LOCALE_COOKIE_KEY } from '~/utils/i18n'

interface I18nLocaleApi {
  locale: Ref<string>
  locales: Ref<{ code: string }[]>
  setLocale: (code: string) => Promise<void>
}

/**
 * Applies the persisted language choice on app start (server + client).
 *
 * Browser-language detection is disabled in `nuxt.config.ts`, so the app always
 * boots in the default locale (English). If the user previously picked a language
 * via the switcher, the `i18n_locale` cookie is restored here before the first
 * render, keeping the choice across hard reloads without ever sniffing the
 * browser language.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const i18n = nuxtApp.$i18n as I18nLocaleApi
  const code = useCookie<string>(LOCALE_COOKIE_KEY).value

  if (!code || code === i18n.locale.value)
    return

  if (i18n.locales.value.some(l => l.code === code))
    await i18n.setLocale(code)
})
