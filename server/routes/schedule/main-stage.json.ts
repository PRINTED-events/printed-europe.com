import { DateTime } from 'luxon'

const MAIN_STAGE_SLUG = 'main-stage'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dayFilter = typeof query.day === 'string' ? query.day : undefined

  const [talks, speakers, customConfig] = await Promise.all([
    queryCollection(event, 'talks').order('dateTime', 'ASC').all(),
    queryCollection(event, 'speakers').all(),
    queryCollection(event, 'customConfig').first(),
  ])

  const timeZone = customConfig?.general?.timeZone || 'UTC'

  const mainStageTalks = talks
    .filter(talk => talk.stage === MAIN_STAGE_SLUG)
    .filter((talk) => {
      if (!dayFilter)
        return true
      const day = DateTime.fromISO(talk.dateTime, { zone: 'utc' }).setZone(timeZone).toISODate()
      return day === dayFilter
    })

  const items = mainStageTalks.map((talk) => {
    const start = DateTime.fromISO(talk.dateTime, { zone: 'utc' })
    const end = start.plus({ minutes: talk.duration })
    const localStart = start.setZone(timeZone)
    const localEnd = end.setZone(timeZone)

    const speakerNames = (talk.speakers ?? [])
      .map(slug => speakers.find(speaker => speaker.slug === slug)?.name)
      .filter(Boolean)

    return {
      slug: talk.slug,
      title: talk.title,
      type: talk.type,
      startUTC: start.toISO(),
      endUTC: end.toISO(),
      // Seconds since local midnight in `timeZone` — this is what a millisecond-of-day
      // based system (like Ontime, which has no timezone concept of its own) needs.
      startSecondsOfDay: localStart.hour * 3600 + localStart.minute * 60 + localStart.second,
      endSecondsOfDay: localEnd.hour * 3600 + localEnd.minute * 60 + localEnd.second
        + (localEnd.hasSame(localStart, 'day') ? 0 : 86400),
      durationMinutes: talk.duration,
      speakers: speakerNames,
    }
  })

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')

  return {
    stage: MAIN_STAGE_SLUG,
    timeZone,
    day: dayFilter ?? null,
    talks: items,
  }
})
