import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AppSettings {
  appName: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  gradientFrom: string
  gradientTo: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'UniFi Hotspot',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#0075ff',
  gradientFrom: '#0075ff',
  gradientTo: '#21d4fd',
}

interface SettingsState {
  settings: AppSettings
  setSettings: (partial: Partial<AppSettings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      setSettings: (partial) => set((st) => ({ settings: { ...st.settings, ...partial } })),
    }),
    { name: 'unifi-settings' }
  )
)

// Aplica a marca no documento: título, favicon/ícones do PWA, theme-color e
// variáveis CSS (cores/gradiente).
export function applyBranding(s: AppSettings) {
  const root = document.documentElement
  root.style.setProperty('--brand-from', s.gradientFrom)
  root.style.setProperty('--brand-to', s.gradientTo)
  root.style.setProperty('--brand-primary', s.primaryColor)

  document.title = s.appName

  const setLink = (rel: string, href: string) => {
    let link = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
    }
    link.href = href
  }

  // Favicon: favicon dedicado > logo > ícone gerado pelo servidor.
  setLink('icon', s.faviconUrl || s.logoUrl || '/api/settings/app-icon/192')
  setLink('apple-touch-icon', s.logoUrl || s.faviconUrl || '/api/settings/app-icon/192')

  let theme = document.querySelector<HTMLMetaElement>("meta[name='theme-color']")
  if (!theme) {
    theme = document.createElement('meta')
    theme.name = 'theme-color'
    document.head.appendChild(theme)
  }
  theme.content = s.primaryColor
}
