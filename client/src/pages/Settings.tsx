import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Input, Button, Upload, ColorPicker, Typography, Space, Alert, message,
} from 'antd'
import { UploadOutlined, DeleteOutlined, MobileOutlined } from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import type { AxiosError } from 'axios'
import { useSettingsStore, applyBranding, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useUpdateSettings } from '../hooks/useSettings'

const { Text } = Typography

// Evento de instalação do PWA (não tipado pela lib padrão do DOM).
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function apiError(err: unknown, fallback: string) {
  return (err as AxiosError<{ message?: string }>)?.response?.data?.message ?? fallback
}

// Lê um arquivo de imagem como data URL (base64), com limite de tamanho.
function makeImageReader(maxKB: number, onDone: (dataUrl: string) => void) {
  return (file: RcFile) => {
    if (!file.type.startsWith('image/')) {
      message.error('Selecione um arquivo de imagem')
      return Upload.LIST_IGNORE
    }
    if (file.size > maxKB * 1024) {
      message.error(`Imagem muito grande (máx. ${maxKB} KB)`)
      return Upload.LIST_IGNORE
    }
    const reader = new FileReader()
    reader.onload = () => onDone(reader.result as string)
    reader.readAsDataURL(file)
    return false // impede o upload automático do antd
  }
}

function ImageField({
  label,
  hint,
  value,
  maxKB,
  onChange,
  previewBg = 'transparent',
}: {
  label: string
  hint: string
  value: string | null
  maxKB: number
  onChange: (v: string | null) => void
  previewBg?: string
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Text style={{ display: 'block', marginBottom: 8 }}>{label}</Text>
      <Space align="center">
        <div
          style={{
            width: 56, height: 56, borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            background: previewBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
        >
          {value ? (
            <img src={value} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>vazio</Text>
          )}
        </div>
        <Upload accept="image/*" showUploadList={false} beforeUpload={makeImageReader(maxKB, onChange)}>
          <Button icon={<UploadOutlined />}>Enviar</Button>
        </Upload>
        {value && (
          <Button icon={<DeleteOutlined />} danger onClick={() => onChange(null)}>
            Remover
          </Button>
        )}
      </Space>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings)
  const setSettings = useSettingsStore((s) => s.setSettings)
  const update = useUpdateSettings()

  const [appName, setAppName] = useState(settings.appName)
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logoUrl)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(settings.faviconUrl)
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor)
  const [gradientFrom, setGradientFrom] = useState(settings.gradientFrom)
  const [gradientTo, setGradientTo] = useState(settings.gradientTo)

  // Instalação do PWA: captura o evento do navegador para oferecer o botão.
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
  }

  // Sincroniza com a marca carregada do servidor (chega de forma assíncrona).
  useEffect(() => {
    setAppName(settings.appName)
    setLogoUrl(settings.logoUrl)
    setFaviconUrl(settings.faviconUrl)
    setPrimaryColor(settings.primaryColor)
    setGradientFrom(settings.gradientFrom)
    setGradientTo(settings.gradientTo)
  }, [settings])

  function restoreDefaults() {
    setAppName(DEFAULT_SETTINGS.appName)
    setLogoUrl(null)
    setFaviconUrl(null)
    setPrimaryColor(DEFAULT_SETTINGS.primaryColor)
    setGradientFrom(DEFAULT_SETTINGS.gradientFrom)
    setGradientTo(DEFAULT_SETTINGS.gradientTo)
  }

  async function handleSave() {
    if (!appName.trim()) {
      message.warning('Informe o nome da aplicação')
      return
    }
    try {
      const saved = await update.mutateAsync({
        appName: appName.trim(),
        logoUrl,
        faviconUrl,
        primaryColor,
        gradientFrom,
        gradientTo,
      })
      setSettings(saved)
      applyBranding(saved)
      message.success('Configurações salvas')
    } catch (err) {
      message.error(apiError(err, 'Erro ao salvar configurações'))
    }
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card title="Identidade">
          <Text style={{ display: 'block', marginBottom: 8 }}>Nome da aplicação</Text>
          <Input
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            maxLength={60}
            placeholder="UniFi Hotspot"
            style={{ marginBottom: 20 }}
          />

          <ImageField
            label="Logo"
            hint="PNG/SVG, fundo transparente. Máx. 5 MB."
            value={logoUrl}
            maxKB={5120}
            onChange={setLogoUrl}
          />

          <ImageField
            label="Favicon"
            hint="Ícone da aba do navegador (PNG/ICO). Máx. 200 KB."
            value={faviconUrl}
            maxKB={200}
            previewBg="#0b1437"
            onChange={setFaviconUrl}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="Cores & gradiente">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Text style={{ display: 'block', marginBottom: 8 }}>Cor primária</Text>
              <ColorPicker
                value={primaryColor}
                disabledAlpha
                onChange={(c) => setPrimaryColor(c.toHexString())}
                showText
              />
            </Col>
            <Col xs={24} sm={8}>
              <Text style={{ display: 'block', marginBottom: 8 }}>Gradiente — início</Text>
              <ColorPicker
                value={gradientFrom}
                disabledAlpha
                onChange={(c) => setGradientFrom(c.toHexString())}
                showText
              />
            </Col>
            <Col xs={24} sm={8}>
              <Text style={{ display: 'block', marginBottom: 8 }}>Gradiente — fim</Text>
              <ColorPicker
                value={gradientTo}
                disabledAlpha
                onChange={(c) => setGradientTo(c.toHexString())}
                showText
              />
            </Col>
          </Row>

          <Text style={{ display: 'block', margin: '20px 0 8px' }}>Pré-visualização</Text>
          <div
            style={{
              height: 64, borderRadius: 14,
              background: `linear-gradient(97deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, letterSpacing: 0.5,
              boxShadow: `0 8px 20px ${primaryColor}55`,
            }}
          >
            {appName || 'Sua marca'}
          </div>
        </Card>
      </Col>

      <Col span={24}>
        <Card title={<Space><MobileOutlined /> Aplicativo instalável (PWA)</Space>}>
          <Alert
            type="info"
            style={{ marginBottom: 16 }}
            message="O nome, o logo e o favicon acima também definem o ícone e o nome do app quando instalado no celular ou na área de trabalho. Salve a marca antes de instalar para que o ícone fique correto."
          />
          {installed ? (
            <Text type="success">Este dispositivo já está com o app instalado.</Text>
          ) : installEvent ? (
            <Button type="primary" icon={<MobileOutlined />} onClick={handleInstall}>
              Instalar app neste dispositivo
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Para instalar: no Chrome/Edge use o ícone de instalar na barra de endereço; no
              iPhone (Safari), use <b>Compartilhar → Adicionar à Tela de Início</b>.
            </Text>
          )}
        </Card>
      </Col>

      <Col span={24}>
        <Space>
          <Button type="primary" size="large" loading={update.isPending} onClick={handleSave}>
            Salvar configurações
          </Button>
          <Button size="large" onClick={restoreDefaults}>
            Restaurar padrão
          </Button>
        </Space>
        <div style={{ marginTop: 10 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            As mudanças valem para todos os usuários e são aplicadas no próximo carregamento (logo/cores/título/favicon).
          </Text>
        </div>
      </Col>
    </Row>
  )
}
