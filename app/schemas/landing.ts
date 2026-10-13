import { property } from '@nuxt/content'
import { z } from 'zod/v4'
import {
  createBaseWithSeoSchema,
  createFeatureItemSchema,
  createImageSchema,
  createLandingBlockBaseSchema,
  createLinkSchema,
  orientationEnum,
  targetEnum,
} from './common'

export const landingSchema = createBaseWithSeoSchema().extend({
  blocks: property(z.array(
    z.discriminatedUnion('component', [

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingCta'),
        links: z.array(createLinkSchema()).optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingFaqPreview'),
        items: z.array(z.object({
          label: z.string().min(1),
          content: z.string().min(1),
        })),
        link: createLinkSchema().optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingFeatures'),
        items: z.array(createFeatureItemSchema()).default([]),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingFloorplan'),
        image: createImageSchema().optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingGallery'),
        images: z.array(createImageSchema()),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingVenueArea'),
        reverse: z.boolean().optional(),
        items: z.array(z.string()).optional(),
        talksStage: z.string().optional(),
        image: createImageSchema().optional(),
        images: z.array(createImageSchema()).optional(),
        logos: z.array(z.object({
          src: z.string().min(1),
          alt: z.string().optional(),
          url: z.string().optional(),
        })).optional(),
        links: z.array(createLinkSchema()).optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingHero'),
        links: z.array(createLinkSchema()).optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingHeroFamily'),
        titleAccent: property(z.string().optional()).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'Closing words of the title, shown in the accent color.',
        }),
        claim: z.array(z.string()).optional(),
        links: z.array(createLinkSchema()).optional(),
        image: createImageSchema().optional(),
        editions: z.array(z.object({
          label: z.string().min(1),
          text: z.string().optional(),
        })).optional(),
        badge: z.object({
          greeting: z.string().optional(),
          names: z.array(z.string().min(1)).min(1),
          role: z.string().optional(),
          note: z.string().optional(),
        }).optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingManifesto'),
        lead: z.string().optional(),
        text: z.string().optional(),
        accent: z.string().optional(),
        items: z.array(z.object({
          not: z.string().min(1),
          instead: z.string().min(1),
        })).optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingPillars'),
        items: z.array(z.object({
          word: z.string().min(1),
          title: z.string().min(1),
          description: z.string().optional(),
          items: z.array(z.string()).optional(),
          image: createImageSchema().optional(),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingMosaic'),
        images: z.array(createImageSchema().extend({
          caption: z.string().optional(),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingStats'),
        items: z.array(z.object({
          value: z.string().min(1),
          suffix: z.string().optional(),
          label: z.string().min(1),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingAudience'),
        image: createImageSchema().optional(),
        items: z.array(z.object({
          text: z.string().min(1),
          reply: z.string().min(1),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingEvents'),
        items: z.array(z.object({
          meta: z.string().optional(),
          title: z.string().min(1),
          description: z.string().optional(),
          image: createImageSchema().optional(),
          links: z.array(createLinkSchema()).optional(),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingPartners'),
        logos: z.array(z.object({
          src: z.string().min(1),
          alt: z.string().optional(),
          url: z.string().optional(),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingVideo'),
        videoUrl: property(z.string().optional()).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'The YouTube Video URL. While it is empty, the block says that the video will follow.',
        }),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingTalkVideos'),
        items: z.array(z.object({
          title: z.string().min(1),
          speaker: z.string().optional(),
          to: property(z.string().optional()).editor({
            // @ts-expect-error `description` is custom and patched in `nuxt-studio`
            description: 'Link to the recording. Leave empty while the recording is not online yet.',
          }),
          image: createImageSchema().optional(),
        })),
        playlistUrl: property(z.string().optional()).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'Link to a public YouTube playlist with the recordings. New videos appear on their own: '
            + 'a video is matched to a talk when its title contains the talk title, e.g. `"Talk title" mit '
            + 'Speaker`. Videos that match no listed talk are added to the end. Only the 15 newest videos '
            + 'of a playlist can be read.',
        }),
        links: z.array(createLinkSchema()).optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingHeroSplit'),
        links: z.array(createLinkSchema()).optional(),
        image: createImageSchema().optional(),
        videoUrl: property(z.string().optional()).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'The YouTube Video URL. If provided, it overrides the image.',
        }),
        features: z.array(z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          icon: z.string().optional(),
        })).optional().default([]),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingHeroCountdown'),
        links: z.array(createLinkSchema()).optional(),
        targetDate: property(z.string().datetime()).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'The target date for the countdown (ISO format, e.g. `2026-10-15T10:00:00Z`).',
        }),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingHeroMedia'),
        links: z.array(createLinkSchema()).optional(),
        image: createImageSchema().optional(),
        video: z.object({
          src: property(z.string().min(1)).editor({
            input: 'media',
            // @ts-expect-error `description` is custom and patched in `nuxt-studio`
            description: 'The source of the video.',
          }),
          poster: property(z.string().optional()).editor({
            input: 'media',
            // @ts-expect-error `description` is custom and patched in `nuxt-studio`
            description: 'The poster image for the video.',
          }),
        }).optional(),
        overlayOpacity: property(z.number().min(0).max(1).default(0.5)).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'The opacity of the black overlay on top of the media (0-1).',
        }),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingMarquee'),
        images: z.array(createImageSchema()),
        direction: z.enum(['left', 'right']).default('left'),
        speed: z.number().default(20),
        gap: z.number().default(0),
        imageHeight: z.number().optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingMetaInfo'),
        height: property(z.enum(['normal', 'small']).default('normal')).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'The vertical size of the section.',
        }),
        items: z.array(z.object({
          icon: property(z.string().min(1)).editor({
            input: 'icon',
            // @ts-expect-error `description` is custom and patched in `nuxt-studio`
            description: 'The icon of the item.',
          }),
          text: property(z.string().min(1)).editor({
            // @ts-expect-error `description` is custom and patched in `nuxt-studio`
            description: 'The text of the item.',
          }),
          label: property(z.string().optional()).editor({
            // @ts-expect-error `description` is custom and patched in `nuxt-studio`
            description: 'The label of the item.',
          }),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingSection'),
        orientation: orientationEnum.optional(),
        reverse: z.boolean().optional(),
        features: z.array(createFeatureItemSchema()).optional(),
        image: createImageSchema().optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingSeparator'),
        label: z.string().optional(),
        icon: property(z.string().optional()).editor({
          input: 'icon',
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'An optional icon for the separator.',
        }),
        avatar: createImageSchema().optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingSpeakers'),
        slugs: property(z.array(z.string()).optional()).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'Speaker slugs to show, in this order. If empty, all featured speakers are shown.',
        }),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingLogoGrid'),
        logos: z.array(z.object({
          src: z.string().min(1),
          alt: z.string().optional(),
          url: z.string().optional(),
        })),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingSponsorMarquee'),
        direction: z.enum(['left', 'right']).default('left'),
        speed: z.number().optional(),
        gap: z.number().optional(),
        imageHeight: z.number().optional(),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingSponsors'),
        showViewAll: property(z.boolean().default(false)).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'Show a "View all Sponsors" button. Links to the sponsors FAQ page, which must '
            + 'be created manually.',
        }),
        viewAllLink: property(z.string().min(1).default('/faq/sponsors')).editor({
          // @ts-expect-error `description` is custom and patched in `nuxt-studio`
          description: 'The link for the "View all Sponsors" button.',
        }),
      }),

      createLandingBlockBaseSchema().extend({
        component: z.literal('AppLandingTestimonials'),
        items: z.array(
          z.object({
            quote: z.string().min(1),
            user: z.object({
              name: z.string().min(1),
              description: z.string().min(1),
              to: z.string().min(1),
              target: targetEnum.optional(),
              avatar: createImageSchema(),
            }),
          }),
        ).default([]),
      }),

    ]),
  )).editor({
    // @ts-expect-error `description` is custom and patched in `nuxt-studio`
    description: '⚠️ NOTE: Click the little dots at the top right of the sidebar and change to "Use code editor" '
      + 'to edit the landing page blocks properly as the visual editor does not support all features here!',
  }),
})
