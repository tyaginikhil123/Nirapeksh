import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import {
  istDayKey,
  loadNewspaperBrief,
  type NewspaperBrief,
  type NewspaperStory,
  type ReportLanguage,
} from '../lib/reportography'
import { formatPublishedAt } from '../lib/youtube'

type LangFilter = 'All' | ReportLanguage

export function ReportographyPage() {
  const { t, lang } = useI18n()
  const [brief, setBrief] = useState<NewspaperBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState<LangFilter>('All')
  const dayRef = useRef(istDayKey())

  useEffect(() => {
    let cancelled = false

    function load() {
      setLoading(true)
      loadNewspaperBrief()
        .then((next) => {
          if (!cancelled) {
            dayRef.current = next.dayKey
            setBrief(next)
          }
        })
        .catch(() => {
          if (!cancelled) {
            const dayKey = istDayKey()
            dayRef.current = dayKey
            setBrief({
              stories: [],
              reportCount: 0,
              sourceCount: 0,
              dayKey,
              fetchedAt: new Date().toISOString(),
            })
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    load()

    function onWake() {
      if (document.visibilityState !== 'visible') return
      const today = istDayKey()
      if (dayRef.current === today) return
      load()
    }

    document.addEventListener('visibilitychange', onWake)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [])

  const stories = useMemo(() => {
    const list = brief?.stories ?? []
    if (language === 'All') return list
    return list.filter((story) =>
      story.reports.some((report) => report.language === language),
    )
  }, [brief, language])

  const [lead, ...rest] = stories

  return (
    <section className="reportography">
      <div className="report-page__intro">
        <p className="report-page__eyebrow">{t('reportographyEyebrow')}</p>
        <h2>{t('reportography')}</h2>
        <p>{t('reportographyLede')}</p>
        <p className="report-page__hint">{t('reportographyHint')}</p>
        <p className="report-page__updated">
          {t('reportographyToday')}:{' '}
          {new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
          }).format(new Date())}
          {' · '}
          {t('reportographyUpdates')}
        </p>
        <div className="report-page__stats">
          <div>
            <strong>{brief?.reportCount ?? '—'}</strong>
            <span>{t('reportographyReports')}</span>
          </div>
          <div>
            <strong>{brief?.sourceCount ?? '—'}</strong>
            <span>{t('reportographySources')}</span>
          </div>
          <div>
            <strong>{stories.length || '—'}</strong>
            <span>{t('reportographyStories')}</span>
          </div>
        </div>
      </div>

      <div className="reportography__filters" role="tablist" aria-label={t('language')}>
        {(['All', 'Hindi', 'English'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={language === option}
            className={`reportography__chip${language === option ? ' is-active' : ''}`}
            onClick={() => setLanguage(option)}
          >
            {option === 'All'
              ? t('allLanguages')
              : option === 'Hindi'
                ? t('reportographyHindi')
                : t('reportographyEnglish')}
          </button>
        ))}
      </div>

      {loading ? <p className="yt-home__status">{t('reportographyLoading')}</p> : null}
      {!loading && stories.length === 0 ? (
        <p className="yt-home__status">{t('reportographyEmpty')}</p>
      ) : null}

      {lead ? <StoryArticle story={lead} languageFilter={language} featured /> : null}
      <div className="reportography__stack">
        {rest.map((story) => (
          <StoryArticle key={story.id} story={story} languageFilter={language} />
        ))}
      </div>
    </section>
  )
}

function kickerLabel(
  kicker: string,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (kicker === 'corruption') return t('kickerCorruption')
  if (kicker === 'breaking') return t('kickerBreaking')
  if (kicker === 'bureaucracy') return t('kickerBureaucracy')
  if (kicker === 'courts') return t('kickerCourts')
  if (kicker === 'investigation') return t('kickerInvestigation')
  if (kicker === 'ground') return t('kickerGround')
  return t('kickerPublic')
}

function StoryArticle({
  story,
  languageFilter,
  featured = false,
}: {
  story: NewspaperStory
  languageFilter: LangFilter
  featured?: boolean
}) {
  const { t, lang } = useI18n()
  const reports =
    languageFilter === 'All'
      ? story.reports
      : story.reports.filter((report) => report.language === languageFilter)
  if (reports.length === 0) return null
  const lead = reports[0]
  const others = reports.slice(1)

  return (
    <article className={`reportography__story${featured ? ' is-lead' : ''}`}>
      <p className="reportography__kicker">{kickerLabel(story.kicker, t)}</p>
      <h3>{lead.title}</h3>
      {lead.dek ? <p className="reportography__dek">{lead.dek}</p> : null}
      <p className="reportography__meta">
        {lead.source}
        {lead.publishedAt ? ` · ${formatPublishedAt(lead.publishedAt, lang)}` : ''}
        {lead.language === 'Hindi' || lead.language === 'English'
          ? ` · ${lead.language === 'Hindi' ? t('reportographyHindi') : t('reportographyEnglish')}`
          : ''}
      </p>
      <a
        className="reportography__read"
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('reportographyRead')} →
      </a>
      {others.length > 0 ? (
        <ul className="reportography__also">
          <li className="reportography__also-label">{t('reportographyAlso')}</li>
          {others.map((report) => (
            <li key={report.id}>
              <a href={report.url} target="_blank" rel="noopener noreferrer">
                {report.source}
              </a>
              <span>{report.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
