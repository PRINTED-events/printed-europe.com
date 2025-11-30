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
     light: '/logo/asset-1.svg',
     dark: '/logo/asset-2.svg',
   },

   favicon: {
     light: '/favicon/asset-4.svg',
     dark: '/favicon/asset-3.svg',
   },

   conferenceFoundingYear: 2025,
  },

  socials: {
    social1: {
     name: 'printedeurope',
     url: 'https://www.instagram.com/printedeurope/',
     icon: 'i-mdi-instagram',
    },
    social2: {
     name: 'Printedeurope',
     url: 'https://www.tiktok.com/@printedeurope/',
     icon: 'i-ic-baseline-tiktok',
    },
    social3: {
     name: 'PRINTED events',
     url: 'https://www.linkedin.com/company/104095382/admin/dashboard/',
     icon: 'i-mdi-linkedin',
    },
    social4: {
      name: '',
      url: '',
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
        name: '',
        icon: '',
        url: '',
      },
      link3: {
        name: '',
        icon: '',
        url: '',
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