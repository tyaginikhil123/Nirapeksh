import { useId, useState } from 'react'
import type { Focus, Language } from '../data/channels'
import { FOCUS_OPTIONS } from '../data/channels'
import { useI18n } from '../i18n/I18nContext'

type DirectoryFiltersProps = {
  query: string
  language: Language | 'All'
  focus: Focus | 'All'
  tag: string | 'All'
  tags: string[]
  sort: 'rating' | 'name'
  bookmarksOnly: boolean
  onQueryChange: (value: string) => void
  onLanguageChange: (value: Language | 'All') => void
  onFocusChange: (value: Focus | 'All') => void
  onTagChange: (value: string | 'All') => void
  onSortChange: (value: 'rating' | 'name') => void
  onBookmarksOnlyChange: (value: boolean) => void
  onRefresh: () => void
  resultCount: number
}

const languages: Array<Language | 'All'> = ['All', 'Hindi', 'English', 'Both']

export function DirectoryFilters({
  query,
  language,
  focus,
  tag,
  tags,
  sort,
  bookmarksOnly,
  onQueryChange,
  onLanguageChange,
  onFocusChange,
  onTagChange,
  onSortChange,
  onBookmarksOnlyChange,
  onRefresh,
  resultCount,
}: DirectoryFiltersProps) {
  const { t } = useI18n()
  const moreId = useId()
  const [moreOpen, setMoreOpen] = useState(false)
  const hasActiveFilters =
    query.trim() !== '' ||
    language !== 'All' ||
    focus !== 'All' ||
    tag !== 'All' ||
    sort !== 'rating' ||
    bookmarksOnly
  const hasAdvanced = tag !== 'All' || sort !== 'rating'

  return (
    <div className={`filters${moreOpen ? ' is-advanced-open' : ''}`}>
      <div className="filters__top">
        <div className="lang-tabs" role="tablist" aria-label={t('language')}>
          {languages.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={language === item}
              className={`lang-tab${language === item ? ' is-active' : ''}`}
              onClick={() => onLanguageChange(item)}
            >
              {item === 'All' ? t('allLanguages') : item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`filters__bookmarks${bookmarksOnly ? ' is-active' : ''}`}
          aria-pressed={bookmarksOnly}
          onClick={() => onBookmarksOnlyChange(!bookmarksOnly)}
        >
          {t('bookmarks')}
        </button>
      </div>

      <div className="filters__primary">
        <div className="filters__search">
          <label htmlFor="channel-search">{t('search')}</label>
          <input
            id="channel-search"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <label className="filters__focus">
          {t('focus')}
          <select
            value={focus}
            onChange={(e) => onFocusChange(e.target.value as Focus | 'All')}
          >
            <option value="All">All</option>
            {FOCUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filters__mobile-bar">
        <div className="filters__mobile-actions">
          <button
            type="button"
            className="filters__more"
            id={moreId}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? t('fewerFilters') : t('moreFilters')}
            {hasAdvanced && !moreOpen ? ' ·' : ''}
          </button>
          <button
            type="button"
            className="filters__refresh filters__refresh--mobile"
            onClick={onRefresh}
            disabled={!hasActiveFilters}
          >
            {t('clearFilters')}
          </button>
        </div>
        <p className="filters__count filters__count--mobile" aria-live="polite">
          {resultCount}
        </p>
      </div>

      <div className="filters__row">
        <label>
          {t('tag')}
          <select
            value={tag}
            onChange={(e) => onTagChange(e.target.value as string | 'All')}
          >
            <option value="All">All</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t('sort')}
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as 'rating' | 'name')}
          >
            <option value="rating">{t('topRated')}</option>
            <option value="name">{t('name')}</option>
          </select>
        </label>

        <div className="filters__actions">
          <p className="filters__count filters__count--desktop" aria-live="polite">
            {resultCount}
          </p>
          <button
            type="button"
            className="filters__refresh"
            onClick={onRefresh}
            disabled={!hasActiveFilters}
          >
            {t('clearFilters')}
          </button>
        </div>
      </div>
    </div>
  )
}
