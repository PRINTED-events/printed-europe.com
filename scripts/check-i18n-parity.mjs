#!/usr/bin/env node
/**
 * @file Verifies that localized content stays in sync with the default locale.
 *
 * Content is authored per locale: the default locale lives at the `content/`
 * root (e.g. `content/1.index.yml`), localized variants live in a locale folder
 * (e.g. `content/de/1.index.yml`). Only the prose differs between them - the
 * structure must not, because the structure is what renders the page.
 *
 * Without this check it is easy to edit only the default locale and ship a
 * homepage that shows different blocks depending on the selected language.
 *
 * The check reports three kinds of drift:
 *   - a file that exists in one locale but not the other
 *   - a differing shape (missing keys, extra keys, different array lengths)
 *   - a differing value for a key whose value is not language-specific
 *     (image paths, links, icons, prices, ...)
 *
 * Run with `pnpm run test:i18n-parity`.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = path.join(projectRoot, 'content')
const localesDir = path.join(projectRoot, 'i18n', 'locales')
const nuxtConfigPath = path.join(projectRoot, 'nuxt.config.ts')

/**
 * Keys whose values carry no language: they must be identical across locales.
 * A translated headline may differ, a logo path or a ticket price may not.
 */
const LANGUAGE_NEUTRAL_KEYS = new Set([
  'color',
  'component',
  'currency',
  'direction',
  'discount',
  'gap',
  'icon',
  'imageHeight',
  'orientation',
  'price',
  'reverse',
  'scale',
  'size',
  'slug',
  'speed',
  'src',
  'target',
  'to',
  'trailing',
  'variant',
])

/** File extensions that are parsed and compared structurally. */
const STRUCTURED_EXTENSIONS = new Set(['.json', '.yaml', '.yml'])

/**
 * Reads `defaultLocale` from the Nuxt i18n config so this check follows the
 * app rather than a hardcoded assumption.
 * @returns {Promise<string>} the default locale code
 */
async function readDefaultLocale() {
  const source = await readFile(nuxtConfigPath, 'utf8')
  const match = source.match(/i18n:\s*\{[\s\S]*?defaultLocale:\s*'([^']+)'/)
  if (!match?.[1])
    throw new Error(`Could not read \`defaultLocale\` from ${path.relative(projectRoot, nuxtConfigPath)}`)
  return match[1]
}

/**
 * Lists the configured locale codes, taken from the translation files.
 * @returns {Promise<string[]>} all locale codes, including the default one
 */
async function readLocaleCodes() {
  const entries = await readdir(localesDir, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.basename(entry.name, '.json'))
}

/**
 * Collects every file below `dir`, as paths relative to `dir`.
 * @param {string} dir directory to walk
 * @param {string} [prefix] relative prefix used while recursing
 * @returns {Promise<string[]>} relative file paths, sorted
 */
async function collectFiles(dir, prefix = '') {
  /** @type {import('node:fs').Dirent[]} */
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return []
  }

  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.'))
      continue
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory())
      files.push(...await collectFiles(path.join(dir, entry.name), relativePath))
    else
      files.push(relativePath)
  }
  return files.sort()
}

/**
 * Parses a structured content file.
 * @param {string} absolutePath file to read
 * @returns {Promise<unknown>} the parsed document
 */
async function parseContentFile(absolutePath) {
  const raw = await readFile(absolutePath, 'utf8')
  return path.extname(absolutePath) === '.json' ? JSON.parse(raw) : parseYaml(raw)
}

/**
 * Describes a value for use in an error message.
 * @param {unknown} value the value to describe
 * @returns {string} a short type label
 */
function describeType(value) {
  if (value === null)
    return 'null'
  if (Array.isArray(value))
    return 'array'
  return typeof value
}

/**
 * Compares two parsed documents and collects every structural difference.
 * @param {unknown} base value from the default locale
 * @param {unknown} translated value from the localized file
 * @param {string} location human readable path into the document
 * @param {string[]} differences accumulator for the messages found
 * @returns {void}
 */
function compare(base, translated, location, differences) {
  if (describeType(base) !== describeType(translated)) {
    differences.push(
      `${location}: type differs (default locale has ${describeType(base)}, `
      + `localized has ${describeType(translated)})`,
    )
    return
  }

  if (Array.isArray(base) && Array.isArray(translated)) {
    if (base.length !== translated.length) {
      differences.push(
        `${location}: ${base.length} item(s) in the default locale, ${translated.length} in the localized file`,
      )
      return
    }
    base.forEach((item, index) => compare(item, translated[index], `${location}[${index}]`, differences))
    return
  }

  if (base !== null && typeof base === 'object') {
    const baseKeys = Object.keys(base)
    const translatedKeys = Object.keys(/** @type {object} */ (translated))
    for (const key of [...new Set([...baseKeys, ...translatedKeys])].sort()) {
      const nextLocation = location ? `${location}.${key}` : key
      if (!baseKeys.includes(key))
        differences.push(`${nextLocation}: present only in the localized file`)
      else if (!translatedKeys.includes(key))
        differences.push(`${nextLocation}: missing from the localized file`)
      else
        compare(base[key], translated[key], nextLocation, differences)
    }
    return
  }

  const key = location.split('.').pop()?.replace(/\[\d+\]$/, '') ?? ''
  if (LANGUAGE_NEUTRAL_KEYS.has(key) && base !== translated) {
    differences.push(
      `${location}: must not be translated `
      + `(default locale has ${JSON.stringify(base)}, localized has ${JSON.stringify(translated)})`,
    )
  }
}

/**
 * Runs the parity check across all configured locales.
 * @returns {Promise<number>} process exit code
 */
async function main() {
  const defaultLocale = await readDefaultLocale()
  const localeCodes = (await readLocaleCodes()).filter(code => code !== defaultLocale)

  /** @type {string[]} */
  const problems = []
  let comparedFiles = 0
  let checkedLocales = 0

  for (const locale of localeCodes) {
    const localeDir = path.join(contentDir, locale)
    const localizedFiles = await collectFiles(localeDir)
    if (localizedFiles.length === 0) {
      console.warn(`- ${locale}: no localized content found, skipping`)
      continue
    }
    checkedLocales++

    // The locale folder decides which areas are localized at all: speakers and
    // talks live only at the root and are intentionally not translated.
    const localizedAreas = new Set(localizedFiles.map(file => file.split('/')[0]))
    const baseFiles = (await collectFiles(contentDir))
      .filter(file => !localeCodes.includes(file.split('/')[0]) && file.split('/')[0] !== defaultLocale)
      .filter(file => localizedAreas.has(file.split('/')[0]))

    for (const file of new Set([...baseFiles, ...localizedFiles]).values()) {
      const basePath = path.join(contentDir, file)
      const localizedPath = path.join(localeDir, file)
      const inBase = baseFiles.includes(file)
      const inLocalized = localizedFiles.includes(file)

      if (!inLocalized) {
        problems.push(`content/${locale}/${file} is missing (exists as content/${file})`)
        continue
      }
      if (!inBase) {
        problems.push(`content/${file} is missing (exists as content/${locale}/${file})`)
        continue
      }
      if (!STRUCTURED_EXTENSIONS.has(path.extname(file)))
        continue

      const differences = []
      compare(await parseContentFile(basePath), await parseContentFile(localizedPath), '', differences)
      comparedFiles++

      if (differences.length > 0) {
        const detail = differences.map(difference => `      - ${difference}`).join('\n')
        problems.push(`content/${locale}/${file} differs from content/${file}:\n${detail}`)
      }
    }
  }

  if (problems.length > 0) {
    console.error('\n  i18n content parity check failed:\n')
    for (const problem of problems)
      console.error(`    x ${problem}`)
    console.error(
      '\n  Localized content must mirror the default locale. Translate the prose, '
      + 'but keep blocks, images, links and prices identical.\n',
    )
    return 1
  }

  console.log(
    `  i18n content parity OK - ${comparedFiles} file(s) compared across `
    + `${checkedLocales} locale(s) against '${defaultLocale}'.`,
  )
  return 0
}

process.exitCode = await main()
