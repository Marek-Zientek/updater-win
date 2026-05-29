import { useState, useEffect } from 'react'

interface AppIconProps {
  wingetId: string
  name: string
  homepage?: string
  size?: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 godziny
const CACHE_PREFIX = 'appicon_v1:'
const CACHE_NULL = '__null__' // Sentinel: IPC zwróciło null (brak ikony) — nie odpytuj ponownie

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function guessDomainFromId(wingetId: string): string | null {
  const publisher = wingetId.split('.')[0]
  if (!publisher) return null
  const orgPublishers = [
    'mozilla',
    'videolan',
    'blender',
    'gimp',
    'inkscape',
    'libreoffice',
    'obsproject',
    'obs'
  ]
  const slug = publisher.toLowerCase()
  const tld = orgPublishers.some((p) => slug.includes(p)) ? 'org' : 'com'
  return `${slug}.${tld}`
}

function hashColor(str: string): string {
  const colors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#a855f7',
    '#d946ef'
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// --- Cache helpers ---

function readCache(domain: string): string | null | 'miss' {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + domain)
    if (!raw) return 'miss'
    const { value, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + domain)
      return 'miss'
    }
    return value === CACHE_NULL ? null : value
  } catch {
    return 'miss'
  }
}

function writeCache(domain: string, value: string | null): void {
  try {
    localStorage.setItem(
      CACHE_PREFIX + domain,
      JSON.stringify({
        value: value ?? CACHE_NULL,
        ts: Date.now()
      })
    )
  } catch {
    // localStorage pełne lub niedostępne — ignoruj
  }
}

// --- Komponent ---

export function AppIcon({ wingetId, name, homepage, size = 32 }: AppIconProps) {
  const domain = (homepage && extractDomain(homepage)) || guessDomainFromId(wingetId)
  const borderRadius = size <= 32 ? '8px' : '14px'
  const fontSize = size <= 32 ? Math.round(size * 0.42) : Math.round(size * 0.38)
  const letter = (name || wingetId).trim()[0]?.toUpperCase() || '?'
  const bgColor = hashColor(wingetId)

  // Inicjalizuj stan z cache (sync) — unikamy migotania
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(() => {
    if (!domain) return null
    const cached = readCache(domain)
    return cached === 'miss' ? null : cached
  })
  const [loading, setLoading] = useState<boolean>(() => {
    if (!domain) return false
    return readCache(domain) === 'miss' // ładuj tylko gdy brak w cache
  })

  useEffect(() => {
    if (!domain) return
    const cached = readCache(domain)
    if (cached !== 'miss') {
      // Cache hit — wynik już ustawiony w useState initializer
      setIconDataUrl(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    window.api
      .fetchAppIcon(domain)
      .then((dataUrl) => {
        if (cancelled) return
        writeCache(domain, dataUrl)
        setIconDataUrl(dataUrl)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        writeCache(domain, null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [domain])

  if (!iconDataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius,
          background: loading
            ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg, ${bgColor}cc, ${bgColor}66)`,
          border: loading ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${bgColor}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize,
          fontWeight: 800,
          color: loading ? 'transparent' : '#fff',
          flexShrink: 0,
          userSelect: 'none',
          letterSpacing: '-0.5px',
          boxShadow: loading ? 'none' : `0 2px 8px ${bgColor}33`,
          transition: 'all 0.3s ease'
        }}
      >
        {!loading && letter}
      </div>
    )
  }

  return (
    <img
      src={iconDataUrl}
      alt={name}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius,
        objectFit: 'contain',
        background: 'rgba(255,255,255,0.04)',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.06)'
      }}
    />
  )
}
