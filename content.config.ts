/**
 * @file Defines the `@nuxt/content` configuration for the application.
 * Contains mainly the schema for content in the `/content/` folder.
 */

import { defineCollection, defineContentConfig } from '@nuxt/content'
import { asSitemapCollection } from '@nuxtjs/sitemap/content'
import { customConfigSchema } from './app/schemas/customConfig'
import { faqSchema } from './app/schemas/faq'
import { landingSchema } from './app/schemas/landing'
import { pageSchema } from './app/schemas/page'
import { speakerSchema } from './app/schemas/speaker'
import { sponsorSchema } from './app/schemas/sponsor'
import { stageSchema } from './app/schemas/stage'
import { talkSchema } from './app/schemas/talk'
import { ticketSchema } from './app/schemas/ticket'

export default defineContentConfig({
  collections: {
    // -------- app config

    customConfig: defineCollection({
      type: 'data',
      source: '0.custom-config.json',
      schema: customConfigSchema,
    }),

    // -------- static pages

    // Home/Landing page (root `1.index.yml` = default locale `en` at path `/`,
    // localized variants live under `<locale>/1.index.yml`, e.g. `de/1.index.yml` at path `/de`)
    index: defineCollection({
      type: 'page',
      source: [
        { include: '1.index.yml' },
        { include: '*/1.index.yml' },
      ],
      schema: landingSchema,
    }),

    // FAQ collection for frequently asked questions
    faq: defineCollection(asSitemapCollection({
      type: 'page',
      source: 'faq/**/*.md',
      schema: faqSchema,
    })),

    // generic pages, e.g. Contact, Privacy Policy, Legal Notice, etc.
    pages: defineCollection(asSitemapCollection({
      type: 'page',
      source: 'pages/**/*.md',
      schema: pageSchema,
    }, {
      name: 'pages',
      // `app/pages/[...slug].vue` serves `/pages/contact` at `/contact`.
      onUrl: (url) => {
        url.loc = String(url.loc).replace(/^\/pages(?=\/|$)/, '')
      },
    })),

    // -------- standalone data

    sponsors: defineCollection({
      type: 'data',
      source: 'sponsors/**/*.yml',
      schema: sponsorSchema,
    }),

    // Tickets (root `tickets/` = default locale `en`, localized variants live
    // under `<locale>/tickets/`, e.g. `de/tickets/`)
    tickets: defineCollection({
      type: 'data',
      source: [
        { include: 'tickets/**/*.yml' },
        { include: '*/tickets/**/*.yml' },
      ],
      schema: ticketSchema,
    }),

    // -------- linked data

    stages: defineCollection({
      type: 'data',
      source: 'stages/**/*.yml',
      schema: stageSchema,
    }),

    speakers: defineCollection(asSitemapCollection({
      type: 'page',
      source: 'speakers/**/*.md',
      schema: speakerSchema,
    }, {
      name: 'speakers',
      // `app/pages/speakers/[...slug].vue` resolves entries by their `slug`
      // field rather than by file name, and the two can differ.
      onUrl: (url, entry) => {
        if (entry?.slug)
          url.loc = `/speakers/${entry.slug}`
      },
    })),

    talks: defineCollection(asSitemapCollection({
      type: 'page',
      source: 'talks/**/*.md',
      schema: talkSchema,
    }, {
      name: 'talks',
      // `app/pages/talks/[...slug].vue` resolves entries by their `slug`
      // field rather than by file name, and the two can differ.
      onUrl: (url, entry) => {
        if (entry?.slug)
          url.loc = `/talks/${entry.slug}`
      },
    })),
  },
})
