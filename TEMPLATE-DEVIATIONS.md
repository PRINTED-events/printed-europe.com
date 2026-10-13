# Deviations from the quick-conf template

This website is built on the [quick-conf](https://github.com/toddeTV/quick-conf) template by Thorsten Seyschab. This file lists what the PRINTED events team changed or added on top of it, so the changes can be handed back to the template author and the template license can be honoured.

- **Template baseline:** quick-conf `1.3.0-rc.0`, upstream commit `7f1bb9a` ("chore: bump version to 1.3.0-rc.0 after release (#153)", 2026-04-17). It was merged into this repository with commit `816cd6b` on 2026-05-04.
- **State described here:** branch `stage`, October 2026.
- **To reproduce the full diff:** `git diff 7f1bb9a -- . ':!content' ':!public' ':!pnpm-lock.yaml'`

Content (`content/**`), images (`public/**`) and the working folders `INPUT/`, `infos für Claude/` and `local-admin/` are specific to PRINTED and are not listed file by file.

## License points to check

`LICENSE.md` puts the source code under the MIT License and reserves all rights for a short list of repository files. Two things follow from that for this repository. This is a summary for the handover, not legal advice.

1. **MIT-licensed code.** The copyright and permission notice has to stay in all copies. `LICENSE.md` is unchanged in this repository, and `package.json` still names Thorsten Seyschab as author. Only the package name was changed, from `quick-conf` to `printed-europe`.
2. **Restricted files were modified.** The license grants no right to create derivative works from `/.github/**` and `/docs/**`. This repository changed files in both folders. They are listed in [Changes to restricted files](#changes-to-restricted-files) and need the author's permission, or have to be reverted or moved out of those folders.

## Changes to restricted files

| File                                         | Change   | What and why                                                                                             |
| :------------------------------------------- | :------- | :------------------------------------------------------------------------------------------------------- |
| `.github/workflows/validation-and-tests.yml` | modified | Runs on pushes to `main` and `stage` as well, and has a new job that runs the i18n content parity check. |
| `.github/workflows/release-please.yml`       | removed  | This website is not released as a versioned package.                                                     |
| `docs/README.md`                             | modified | Links the new multi-language page.                                                                       |
| `docs/developer-setup.md`                    | modified | Describes the pre-push hook.                                                                             |
| `docs/multi-language-content.md`             | added    | Explains how localized content is organised and checked.                                                 |

## New landing page blocks

All blocks live in `app/components/app/landing/`, are registered in `app/schemas/landing.ts` and are rendered through `AppLandingBlocks`. They take the usual `title`, `description`, `headline` and `class` props unless noted.

| Block                      | Purpose                                                                                                                                                                                                    | Own props                                                                                      |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `AppLandingLogoGrid`       | Grid of sponsor logos as cards, four per row.                                                                                                                                                              | `logos[]` (`src`, `alt`, `url`)                                                                |
| `AppLandingSponsorMarquee` | Scrolling strip of all logos from the `sponsors` collection.                                                                                                                                               | `direction`, `speed`, `gap`, `imageHeight`                                                     |
| `AppLandingVenueArea`      | One area of the venue with photos, bullet points, logos and optionally the talks of one stage.                                                                                                             | `reverse`, `items[]`, `talksStage`, `image`, `images[]`, `logos[]`, `links[]`                  |
| `AppLandingFloorplan`      | Venue map as a single large image.                                                                                                                                                                         | `image`                                                                                        |
| `AppLandingHeroFamily`     | Hero with a three-word claim, a two-tone title, a list of upcoming editions and an animated name badge.                                                                                                    | `titleAccent`, `claim[]`, `links[]`, `image`, `editions[]`, `badge`                            |
| `AppLandingManifesto`      | One large statement in three tones, followed by "not this, but that" pairs.                                                                                                                                | `lead`, `text`, `accent`, `items[]` (`not`, `instead`)                                         |
| `AppLandingPillars`        | Alternating image and text rows, each with an outlined keyword.                                                                                                                                            | `items[]` (`word`, `title`, `description`, `items[]`, `image`)                                 |
| `AppLandingMosaic`         | Photo wall in an uneven grid with captions.                                                                                                                                                                | `images[]` (`src`, `alt`, `caption`)                                                           |
| `AppLandingStats`          | Band of large figures. No `description` or `headline`; `title` is the accessible name.                                                                                                                     | `items[]` (`value`, `suffix`, `label`)                                                         |
| `AppLandingAudience`       | Image next to a list of statements, each with a short reply.                                                                                                                                               | `image`, `items[]` (`text`, `reply`)                                                           |
| `AppLandingEvents`         | Cards for events, each with image, meta line, text and buttons.                                                                                                                                            | `items[]` (`meta`, `title`, `description`, `image`, `links[]`)                                 |
| `AppLandingPartners`       | Heading on the left, compact logo wall on the right.                                                                                                                                                       | `logos[]` (`src`, `alt`, `url`)                                                                |
| `AppLandingVideo`          | Embedded YouTube video, loaded on click through `youtube-nocookie.com`. Says "video coming soon" while `videoUrl` is empty.                                                                                | `videoUrl`                                                                                     |
| `AppLandingTalkVideos`     | Grid of talk recordings. An entry without a link is shown as "upload pending". With `playlistUrl`, the videos of a YouTube playlist are matched to the entries by title and unmatched videos are appended. | `items[]` (`title`, `speaker`, `to`, `image`), `playlistUrl`, `excludedVideoUrls[]`, `links[]` |

Two helper components are not blocks themselves: `AppLandingBlockHead` is the left-aligned heading shared by the new blocks, and `AppLandingBlocks` turns a `blocks` array into components. The component map that used to sit in `app/pages/index.vue` moved into `AppLandingBlocks`.

## Changes to template blocks

| Block                     | Change                                                                                                                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| every block               | New optional `id` in `createLandingBlockBaseSchema()` (`app/schemas/common.ts`), so `/#partners` style links work.                                                  |
| `AppLandingSpeakers`      | New optional `slugs[]`: shows exactly these speakers in this order, without the "view all" card. Without it, the featured speakers of the upcoming event are shown. |
| `AppLandingMarquee`       | New optional `imageHeight` in pixels, default 128.                                                                                                                  |
| `AppLandingHero`          | Fixed background photo through a global `.hero-bg` class. Specific to PRINTED, not suited for upstream as is.                                                       |
| `AppLandingHeroCountdown` | Labels come from the translation files instead of being hard-coded in English.                                                                                      |

## Other code changes

**Two languages (English and German).** `@nuxtjs/i18n` was added with the `no_prefix` strategy, so URLs stay the same and the language is stored in a cookie. Interface texts are in `i18n/locales/en.json` and `de.json`. Content is localized by folder: `content/1.index.yml` is English, `content/de/1.index.yml` is German. Touched for this: `nuxt.config.ts`, `content.config.ts`, `app/app.vue`, `AppHeader.vue`, `AppFooter.vue`, the new `AppLanguageSwitcher.vue`, and the pages `schedule`, `tickets`, `faq/[...slug]`, `speakers/index`, `speakers/[...slug]` and `talks/[...slug]`, where hard-coded English strings became translation keys.

**Content parity check.** `scripts/check-i18n-parity.mjs` fails when a localized content file differs in structure from the default locale. It runs as `pnpm run test:i18n-parity`, in CI and in the pre-push hook `.githooks/pre-push`. New dev dependency: `yaml`.

**Archive pages.** `app/pages/archive/[slug].vue` and the `archive` collection in `content.config.ts` serve a recap of a past event at `/archive/<slug>` from `content/archive/<slug>.yml`, with the same blocks as the homepage. `nuxt.config.ts` adds these pages to the sitemap.

**Venue screens and embeds.** `app/pages/screen1.vue` and `screen2.vue` are full-screen views for the monitors at the venue, with `/kiosk` redirecting to `screen2`. `app/pages/embed/schedule.vue` with `app/layouts/embed.vue` is a schedule without header and footer. `server/routes/schedule/` provides the main stage schedule as CSV and JSON plus a version endpoint that the screens poll to reload themselves. These pages and `display.vue` are marked `noindex` and are excluded from the sitemap.

**Smaller changes.**

- Speakers: new `currentEvent` flag in `app/schemas/speaker.ts`. `app/pages/speakers/index.vue` lists only speakers with the flag and shows a "lineup will be announced soon" card when there are none. Every speaker keeps a profile page, so recaps of past events can still link to it.
- `app/pages/tickets.vue`: tickets load per locale with a fallback to English, an accessibility note (`app/components/content/AccessibilityNote.vue`) sits below the plans, and an empty ticket list shows a "ticket sales open soon" card.
- `app/components/AppHeader.vue`: navigation of the PRINTED site, an "Events" menu that links the other PRINTED event sites, and the language switcher.
- `app/components/AppFooter.vue`: translated labels and a copyright year span.
- `app/composables/useSimplifiedColorMode.ts`: adjusted for the dark-only setup.
- `app/utils/talk.ts`: the talk type is matched case-insensitively. This is a bug fix that applies to the template as well.
- `app/utils/youtube.ts`: new helpers that read video and playlist ids from YouTube URLs and split a recording title into talk title and speaker.
- `server/api/youtube-playlist.get.ts`: lists the videos of a public YouTube playlist without an API key, cached for ten minutes. It reads the public playlist page (up to 100 videos) and falls back to YouTube's feed (15 videos).
- `content.config.ts`: sitemap URLs for speakers and talks are built from the `slug` field, because the pages resolve by slug and not by file name. Pages under `content/pages/` are listed without the `/pages` prefix.
- `nuxt.config.ts`: `i.ytimg.com` as an allowed image domain, so recording thumbnails are served through the website, sitemap exclusions, the `/kiosk` redirect, and a redirect from `/tickets` to the external ticket shop, and Vercel preview deployments use their own address as site URL.
- Fonts: Inter is self-hosted through the new dependency `@fontsource-variable/inter` (imported in `app/assets/css/main.css`, set as `--font-sans` in `public/custom-styles.css`). The template ships no font file, so the configured typeface only appeared on devices that had it installed.
- `eslint.config.mjs`: no line length limit for translation files, console output allowed in `scripts/*.mjs`.

## Suggested for upstream

These changes are not tied to PRINTED and could go back into the template:

1. The case-insensitive talk type lookup in `app/utils/talk.ts`.
2. The slug-based sitemap URLs in `content.config.ts`.
3. The optional `id` on every block and `slugs[]` on `AppLandingSpeakers`.
4. `imageHeight` on `AppLandingMarquee`.
5. The generic blocks `AppLandingLogoGrid`, `AppLandingStats`, `AppLandingVideo`, `AppLandingTalkVideos`, `AppLandingMosaic` and `AppLandingEvents`.
6. The i18n setup together with the parity check, as an optional feature.
7. Archive pages at `/archive/<slug>`.

## Keeping this file current

Add a line here whenever a template file is changed or a block is added. The command at the top shows whether the list is still complete.
