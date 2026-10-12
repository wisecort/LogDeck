// Small inline SVG icons (stroke = currentColor), so every theme colours them.
import type { ReactNode } from 'react'

function Svg({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const IconSearch = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)
export const IconBan = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.7 5.7 12.6 12.6" />
  </Svg>
)
export const IconClock = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const IconChart = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
)
/** Export: document with an arrow leaving it (distinct from "go to top"). */
export const IconExport = () => (
  <Svg>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    <path d="M14 3v5h5M11 13l9-9M15 4h5v5" />
  </Svg>
)
export const IconToTop = () => (
  <Svg>
    <path d="M5 4h14M12 20V9M7 13l5-5 5 5" />
  </Svg>
)
export const IconTrash = () => (
  <Svg>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Svg>
)
export const IconStack = () => (
  <Svg>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
)
export const IconWrap = () => (
  <Svg>
    <path d="M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M4 18h5M14 16l-2 2 2 2" />
  </Svg>
)
export const IconRefresh = () => (
  <Svg>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </Svg>
)
export const IconTerminal = () => (
  <Svg>
    <path d="m5 7 5 5-5 5M12 19h7" />
  </Svg>
)
export const IconStar = ({ filled = false }: { filled?: boolean }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 2.9 1-6.1L3 9.5l6.2-.9L12 3Z" />
  </svg>
)
export const IconBookmark = ({ filled = false }: { filled?: boolean }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12v18l-6-4-6 4V3Z" />
  </svg>
)
export const IconSparkle = () => (
  <Svg>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
)
export const IconGear = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
)
export const IconKeyboard = () => (
  <Svg>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
  </Svg>
)
export const IconChevron = ({ open }: { open: boolean }) => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .12s' }}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)
export const IconX = () => (
  <Svg size={13}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IconCopy = () => (
  <Svg size={13}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Svg>
)
export const IconFile = () => (
  <Svg>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Svg>
)
export const IconSliders = () => (
  <Svg>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Svg>
)
