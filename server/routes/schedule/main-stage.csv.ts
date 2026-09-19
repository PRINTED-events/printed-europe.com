import { DateTime } from 'luxon'

const MAIN_STAGE_SLUG = 'main-stage'

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dayFilter = typeof query.day === 'string' ? query.day : undefined

  const [talks, stages, speakers, customConfig] = await Promise.all([
    queryCollection(event, 'talks').order('dateTime', 'ASC').all(),
    queryCollection(event, 'stages').all(),
    queryCollection(event, 'speakers').all(),
    queryCollection(event, 'customConfig').first(),
  ])

  const timeZone = customConfig?.general?.timeZone || 'UTC'
  const mainStage = stages.find(stage => stage.slug === MAIN_STAGE_SLUG)

  const mainStageTalks = talks
    .filter(talk => talk.stage === MAIN_STAGE_SLUG)
    .filter((talk) => {
      if (!dayFilter)
        return true
      const day = DateTime.fromISO(talk.dateTime, { zone: 'utc' }).setZone(timeZone).toISODate()
      return day === dayFilter
    })

  const rows = mainStageTalks.map((talk) => {
    const start = DateTime.fromISO(talk.dateTime, { zone: 'utc' }).setZone(timeZone)
    const end = start.plus({ minutes: talk.duration })

    const speakerNames = (talk.speakers ?? [])
      .map(slug => speakers.find(speaker => speaker.slug === slug)?.name)
      .filter(Boolean)
      .join(', ')

    return {
      Start: start.toFormat('HH:mm:ss'),
      End: end.toFormat('HH:mm:ss'),
      Title: talk.title,
      Cue: talk.slug,
      Note: speakerNames,
    }
  })

  const header = ['Start', 'End', 'Title', 'Cue', 'Note']
  const lines = [
    header.join(','),
    ...rows.map(row => header.map(key => csvEscape(String(row[key as keyof typeof row] ?? ''))).join(',')),
  ]

  const filenameParts = [mainStage?.slug ?? 'main-stage', dayFilter, 'schedule'].filter(Boolean)

  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filenameParts.join('-')}.csv"`)

  return lines.join('\n')
})
