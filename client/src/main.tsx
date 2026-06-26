import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider, theme } from 'antd'
import ptBR from 'antd/locale/pt_BR'
import App from './App'
import { useSettingsStore, applyBranding } from './store/settingsStore'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

// Tema inspirado no Vision UI Dashboard (dark + glass + acentos em gradiente)
const visionTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#0075ff',
    colorInfo: '#0075ff',
    colorSuccess: '#01b574',
    colorWarning: '#ffb547',
    colorError: '#ee5d50',
    colorBgBase: '#070b25',
    colorBgContainer: '#0f1535',
    colorBgElevated: '#111c44',
    colorBorder: 'rgba(255, 255, 255, 0.14)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
    colorTextBase: '#ffffff',
    borderRadius: 14,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
  },
  components: {
    Layout: { siderBg: 'transparent', headerBg: 'transparent', bodyBg: 'transparent' },
    Menu: { itemBg: 'transparent', subMenuItemBg: 'transparent', darkItemBg: 'transparent' },
  },
}

function Root() {
  const settings = useSettingsStore((s) => s.settings)
  const setSettings = useSettingsStore((s) => s.setSettings)

  // Carrega a marca do servidor na inicialização (rota pública).
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => setSettings(s))
      .catch(() => {})
  }, [setSettings])

  // Aplica título/favicon/variáveis CSS sempre que a marca mudar.
  useEffect(() => {
    applyBranding(settings)
  }, [settings])

  const themed = {
    ...visionTheme,
    token: {
      ...visionTheme.token,
      colorPrimary: settings.primaryColor,
      colorInfo: settings.primaryColor,
    },
  }

  return (
    <ConfigProvider locale={ptBR} theme={themed}>
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>
)

// Registra o service worker do PWA (instalação + suporte offline).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
