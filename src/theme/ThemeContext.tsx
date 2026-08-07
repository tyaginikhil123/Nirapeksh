import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark'

export type Palette = 'teal' | 'ocean' | 'saffron' | 'slate' | 'coral'

export const PALETTE_OPTIONS: Array<{
  id: Palette
  label: string
  swatch: string
}> = [
  { id: 'teal', label: 'Teal', swatch: 'linear-gradient(135deg, #0c6b5c, #ef7a12)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #0b4f6c, #f07167)' },
  { id: 'saffron', label: 'Saffron', swatch: 'linear-gradient(135deg, #1b4332, #e9c46a)' },
  { id: 'slate', label: 'Slate', swatch: 'linear-gradient(135deg, #334155, #f59e0b)' },
  { id: 'coral', label: 'Coral', swatch: 'linear-gradient(135deg, #1d3557, #e76f51)' },
]

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
  palette: Palette
  setPalette: (palette: Palette) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const THEME_KEY = 'nirpeksh-theme'
const PALETTE_KEY = 'nirpeksh-palette'

function readPalette(): Palette {
  const saved = localStorage.getItem(PALETTE_KEY)
  if (
    saved === 'teal' ||
    saved === 'ocean' ||
    saved === 'saffron' ||
    saved === 'slate' ||
    saved === 'coral'
  ) {
    return saved
  }
  return 'teal'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })
  const [palette, setPaletteState] = useState<Palette>(() => readPalette())

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.palette = palette
    localStorage.setItem(PALETTE_KEY, palette)
  }, [palette])

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
      palette,
      setPalette: setPaletteState,
    }),
    [theme, palette],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
