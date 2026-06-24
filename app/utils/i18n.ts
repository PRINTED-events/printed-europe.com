/**
 * Cookie key used to persist the user's manually selected language.
 *
 * Browser-language auto-detection is intentionally disabled (the site always
 * starts in the default locale), so this cookie is the single source of truth
 * for remembering a manual switch across reloads. Read by `plugins/i18n-locale.ts`
 * and written by `AppLanguageSwitcher.vue`.
 */
export const LOCALE_COOKIE_KEY = 'i18n_locale'
