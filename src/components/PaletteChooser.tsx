import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PALETTE_OPTIONS, useTheme } from '../theme/ThemeContext'

type MenuPos = { top: number; left: number }

export function PaletteChooser() {
  const { palette, setPalette } = useTheme()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos>({ top: 0, left: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const active = PALETTE_OPTIONS.find((option) => option.id === palette)

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return

    function place() {
      const trigger = rootRef.current?.querySelector('.palette-trigger')
      if (!(trigger instanceof HTMLElement)) return
      const rect = trigger.getBoundingClientRect()
      const menuWidth = 148
      const gap = 8
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      )
      const top = Math.min(rect.bottom + gap, window.innerHeight - 220)
      setPos({ top, left })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const menu = open
    ? createPortal(
        <div
          className="palette-menu"
          id={menuId}
          ref={menuRef}
          role="listbox"
          aria-label="Color themes"
          style={{ top: pos.top, left: pos.left }}
        >
          {PALETTE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={palette === option.id}
              className={`palette-menu__item${palette === option.id ? ' is-active' : ''}`}
              onClick={() => {
                setPalette(option.id)
                setOpen(false)
              }}
            >
              <span
                className="palette-menu__swatch"
                style={{ background: option.swatch }}
                aria-hidden="true"
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null

  return (
    <div className="palette-chooser" ref={rootRef}>
      <button
        type="button"
        className="palette-trigger"
        aria-label={`Color theme: ${active?.label ?? 'Teal'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        title="Colors"
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="palette-trigger__swatch"
          style={{ background: active?.swatch }}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  )
}
