/**
 * Application configuration file.
 * Schema is defined in `nuxt.schema.ts`.
 */
export default defineAppConfig({
  general: {
   conferenceName: 'Printed Worldconference',

   // conferenceFoundingYear: 2025,
   timeZone: 'Europe/Berlin',

   logo: {
     light: '/logo/printed-pd-kopie-01-2.svg',
     dark: '/logo/dark.svg',
   },

   favicon: {
     light: '/favicon/favicon.svg',
     dark: '/favicon/favicon.svg',
   },

   conferenceFoundingYear: 2025,
  },

  socials: {
    social1: {
      name: 'Printed Events',
      url: 'https://instagram.com/@printedeurope',
    },
    social2: {
      name: 'toddeTV',
      url: 'https://bsky.app/profile/todde.tv',
    },
    social3: {
      name: 'toddeTV',
      url: 'https://www.linkedin.com/in/toddetv/',
    },
    social4: {
      name: 'toddeTV',
      url: 'https://github.com/toddeTV/',
    },
  },

  customFooterColumn: {
    title: '',
    links: {
      link1: {
        name: '',
        // icon: 'i-lucide-house',
        url: '/',
      },
      link2: {
        name: 'some link with icon',
        icon: 'i-lucide-house',
        url: '/',
      },
      link3: {
        name: 'external links also work',
        icon: 'i-simple-icons-x',
        url: 'https://x.com/toddeTV',
      },
    },
  },

  ui: { // for `@nuxt/ui`
    colors: {
      primary: 'brand',
      neutral: 'slate',
    },
  },
})