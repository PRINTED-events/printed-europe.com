import { createHash } from 'node:crypto'

// Fingerprint of the deployed schedule. The screen pages poll this and
// reload themselves when it changes: their content database is cached in
// the browser, so re-querying it never surfaces a new deployment.
export default defineEventHandler(async (event) => {
  const [talks, speakers, stages] = await Promise.all([
    queryCollection(event, 'talks').order('dateTime', 'ASC').all(),
    queryCollection(event, 'speakers').all(),
    queryCollection(event, 'stages').all(),
  ])

  // The build id changes with every deployment, so the screens also pick up
  // things the content query can't see — images, styling, code
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA
    || useRuntimeConfig(event).app?.buildId
    || 'dev'

  const fingerprint = JSON.stringify([
    buildId,
    talks.map(t => [t.slug, t.title, t.dateTime, t.duration, t.stage, t.type, t.speakers]),
    speakers.map(s => [s.slug, s.name, s.image, s.description, s.company]),
    stages.map(s => [s.slug, s.name]),
  ])

  setResponseHeaders(event, {
    'cache-control': 'no-store, max-age=0, must-revalidate',
  })

  return {
    hash: createHash('sha256').update(fingerprint).digest('hex').slice(0, 16),
    talks: talks.length,
  }
})
