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
  const hasActiveFilters =
    query.trim() !== '' ||
    language !== 'All' ||
    focus !== 'All' ||
    tag !== 'All' ||
    sort !== 'rating' ||
    bookmarksOnly

  return (
    <div className="filters">
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

      <div className="filters__row">
        <label>
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
          <label className="filters__check">
            <input
              type="checkbox"
              checked={bookmarksOnly}
              onChange={(e) => onBookmarksOnlyChange(e.target.checked)}
            />
            {t('showBookmarks')}
          </label>
          <p className="filters__count" aria-live="polite">
            {resultCount}
          </p>
          <button
            type="button"
            className="filters__refresh"
            onClick={onRefresh}
            disabled={!hasActiveFilters}
          >
            {t('refresh')}
          </button>
        </div>
      </div>
    </div>
  )
}
