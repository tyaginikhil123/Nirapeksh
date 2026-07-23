import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { t, type DictKey, type UiLang } from '../i18n/dictionary'

type I18nContextValue = {
  lang: UiLang
  setLang: (lang: UiLang) => void
  t: (key: DictKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)
const KEY = 'nirapeksh-ui-lang'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>(() => {
    const saved = localStorage.getItem(KEY)
    return saved === 'hi' ? 'hi' : 'en'
  })

  function setLang(next: UiLang) {
    setLangState(next)
    localStorage.setItem(KEY, next)
    document.documentElement.lang = next === 'hi' ? 'hi' : 'en'
  }

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key: DictKey) => t(lang, key),
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
