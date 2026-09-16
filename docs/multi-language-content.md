# Multi-Language Content

The site is available in English and German. This page explains how localized
content is stored and how it is kept in sync.

## How localized content is stored

The default locale (`en`) lives at the root of `content/`, every other locale in
a folder named after its code:

```txt
content/
  1.index.yml          <- English homepage
  tickets/             <- English tickets
  de/
    1.index.yml        <- German homepage
    tickets/           <- German tickets
  speakers/            <- not localized
  talks/               <- not localized
```

Speakers, talks, stages and sponsors are intentionally **not** localized: they
hold names and data rather than prose.

> [!IMPORTANT]
> The two homepage files are complete, independent copies. Adding a block to
> `content/1.index.yml` does **not** add it to `content/de/1.index.yml`.
> Every content change has to be made in both files.

## What must stay identical

Translate the prose - headlines, titles, descriptions, feature lists, button
labels. Everything else has to match exactly, because it is what renders the
page rather than what the visitor reads:

- the number of blocks and their order
- the `component` of each block
- image paths (`src`), links (`url`, `to`, `target`) and `icon` names
- ticket `price`, `discount`, `scale` and `slug`

If the two files disagree about those, visitors see a different site depending
on their language - which is exactly the bug this check exists to prevent.

## The parity check

```bash
pnpm run test:i18n-parity
```

It compares every localized file against its default-locale counterpart and
reports missing files, differing block counts and translated-by-accident values:

```txt
  i18n content parity check failed:

    x content/de/1.index.yml differs from content/1.index.yml:
      - blocks: 23 item(s) in the default locale, 21 in the localized file
```

The check runs in three places:

1. **Locally on push** via a Git hook, which aborts the push. Enable it once per
   clone:

   ```bash
   git config core.hooksPath .githooks
   ```

   To push anyway in an emergency, use `git push --no-verify`.

2. **In CI** on every push to `main` and `stage` and on every pull request, as
   the `i18n Content Parity Check` job.

3. **As part of `pnpm test`**, together with the other checks.

## Adding a locale

1. Add the translation file `i18n/locales/<code>.json`.
2. Register the locale in the `i18n.locales` array in `nuxt.config.ts`.
3. Copy `content/1.index.yml` and `content/tickets/` into `content/<code>/` and
   translate the prose.
4. Run `pnpm run test:i18n-parity` to confirm the copy is structurally intact.

The check reads the locale list from `i18n/locales/` and the default locale from
`nuxt.config.ts`, so it picks up the new locale automatically.
