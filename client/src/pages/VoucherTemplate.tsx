import { useEffect, useState } from 'react'
import {
  Card, Row, Col, Input, InputNumber, Button, Upload, ColorPicker,
  Switch, Typography, Space, Empty, Spin, message,
} from 'antd'
import { UploadOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import { useCompanyStore } from '../store/companyStore'
import { useCompanies } from '../hooks/useCompanies'
import { useVoucherTemplate, useUpdateVoucherTemplate } from '../hooks/useVoucherTemplate'
import { renderVoucherCard, voucherStyles, printVouchers } from '../utils/voucherPrint'
import type { Voucher, VoucherTemplate } from '../types'

const { Text } = Typography
const { TextArea } = Input

type Form = Omit<VoucherTemplate, 'id' | 'companyId'>

const EMPTY: Form = {
  logoUrl: null,
  bgColor: '#ffffff',
  textColor: '#111111',
  accentColor: '#0075ff',
  borderColor: '#999999',
  headerText: null,
  subtitle: null,
  wifiName: null,
  instructions: null,
  footerText: null,
  cardsPerRow: 3,
  showLogo: true,
  showPrice: true,
  showPlan: true,
  showDuration: true,
}

// Vouchers de exemplo para a pré-visualização.
const SAMPLE: Voucher[] = [
  {
    id: 's1', code: '62655275019',
    plan: { name: 'Plano 2 horas', price: 5, timeLimitMinutes: 120 },
  } as Voucher,
  {
    id: 's2', code: '33020863820',
    plan: { name: 'Plano 2 horas', price: 5, timeLimitMinutes: 120 },
  } as Voucher,
]

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
    return false
  }
}

export default function VoucherTemplatePage() {
  const { selectedCompanyId } = useCompanyStore()
  const { data: companies = [] } = useCompanies()
  const { data: template, isLoading } = useVoucherTemplate(selectedCompanyId)
  const update = useUpdateVoucherTemplate()

  const [form, setForm] = useState<Form>(EMPTY)
  const companyName = companies.find((c) => c.id === selectedCompanyId)?.name ?? 'Empresa'

  useEffect(() => {
    if (template) {
      const { id: _id, companyId: _c, ...rest } = template
      setForm(rest)
    }
  }, [template])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!selectedCompanyId) return
    try {
      await update.mutateAsync({ companyId: selectedCompanyId, ...form })
      message.success('Personalização salva')
    } catch {
      message.error('Erro ao salvar personalização')
    }
  }

  if (!selectedCompanyId) {
    return <Empty description="Selecione uma empresa na barra lateral" style={{ marginTop: 64 }} />
  }
  if (isLoading) {
    return <div style={{ textAlign: 'center', marginTop: 64 }}><Spin /></div>
  }

  const previewDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { margin: 0; padding: 14px; background: #e9eef5; }
    ${voucherStyles(form, Math.min(form.cardsPerRow, 2))}
  </style></head><body>
    <div class="vt-grid">${SAMPLE.map((v) => renderVoucherCard(v, form, companyName)).join('')}</div>
  </body></html>`

  return (
    <Row gutter={[16, 16]}>
      {/* ---- Coluna de edição ---- */}
      <Col xs={24} lg={12}>
        <Card title="Logo & cores" style={{ marginBottom: 16 }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>Logo do voucher</Text>
          <Space align="center" wrap style={{ marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: '#fff',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {form.logoUrl
                ? <img src={form.logoUrl} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <Text type="secondary" style={{ fontSize: 11 }}>vazio</Text>}
            </div>
            <Upload accept="image/*" showUploadList={false} beforeUpload={makeImageReader(5120, (v) => set('logoUrl', v))}>
              <Button icon={<UploadOutlined />}>Enviar</Button>
            </Upload>
            {form.logoUrl && (
              <Button icon={<DeleteOutlined />} danger onClick={() => set('logoUrl', null)}>Remover</Button>
            )}
            <Switch checked={form.showLogo} onChange={(v) => set('showLogo', v)} /> <Text type="secondary">Exibir logo</Text>
          </Space>

          <Row gutter={[12, 12]}>
            <Col xs={12} sm={6}>
              <Text style={{ display: 'block', marginBottom: 6 }}>Fundo</Text>
              <ColorPicker value={form.bgColor} disabledAlpha showText onChange={(c) => set('bgColor', c.toHexString())} />
            </Col>
            <Col xs={12} sm={6}>
              <Text style={{ display: 'block', marginBottom: 6 }}>Texto</Text>
              <ColorPicker value={form.textColor} disabledAlpha showText onChange={(c) => set('textColor', c.toHexString())} />
            </Col>
            <Col xs={12} sm={6}>
              <Text style={{ display: 'block', marginBottom: 6 }}>Destaque</Text>
              <ColorPicker value={form.accentColor} disabledAlpha showText onChange={(c) => set('accentColor', c.toHexString())} />
            </Col>
            <Col xs={12} sm={6}>
              <Text style={{ display: 'block', marginBottom: 6 }}>Borda</Text>
              <ColorPicker value={form.borderColor} disabledAlpha showText onChange={(c) => set('borderColor', c.toHexString())} />
            </Col>
          </Row>
        </Card>

        <Card title="Textos" style={{ marginBottom: 16 }}>
          <Text style={{ display: 'block', marginBottom: 6 }}>Cabeçalho</Text>
          <Input
            value={form.headerText ?? ''} maxLength={60} style={{ marginBottom: 16 }}
            placeholder={companyName}
            onChange={(e) => set('headerText', e.target.value || null)}
          />
          <Text style={{ display: 'block', marginBottom: 6 }}>Rótulo do código</Text>
          <Input
            value={form.subtitle ?? ''} maxLength={40} style={{ marginBottom: 16 }}
            placeholder="Código de acesso"
            onChange={(e) => set('subtitle', e.target.value || null)}
          />
          <Text style={{ display: 'block', marginBottom: 6 }}>Nome da rede WiFi (SSID)</Text>
          <Input
            value={form.wifiName ?? ''} maxLength={40} style={{ marginBottom: 16 }}
            placeholder="ex: Barco-WiFi"
            onChange={(e) => set('wifiName', e.target.value || null)}
          />
          <Text style={{ display: 'block', marginBottom: 6 }}>Instruções de conexão</Text>
          <TextArea
            value={form.instructions ?? ''} maxLength={300} rows={2} style={{ marginBottom: 16 }}
            placeholder="Conecte-se à rede e informe o código no portal."
            onChange={(e) => set('instructions', e.target.value || null)}
          />
          <Text style={{ display: 'block', marginBottom: 6 }}>Rodapé</Text>
          <Input
            value={form.footerText ?? ''} maxLength={80}
            placeholder="ex: Obrigado pela preferência!"
            onChange={(e) => set('footerText', e.target.value || null)}
          />
        </Card>

        <Card title="Layout">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space align="center">
              <Text>Cards por linha (impressão):</Text>
              <InputNumber min={1} max={5} value={form.cardsPerRow} onChange={(v) => set('cardsPerRow', v ?? 3)} />
            </Space>
            <Space wrap size="large">
              <span><Switch checked={form.showPlan} onChange={(v) => set('showPlan', v)} /> <Text type="secondary">Plano</Text></span>
              <span><Switch checked={form.showDuration} onChange={(v) => set('showDuration', v)} /> <Text type="secondary">Duração</Text></span>
              <span><Switch checked={form.showPrice} onChange={(v) => set('showPrice', v)} /> <Text type="secondary">Preço</Text></span>
            </Space>
          </Space>
        </Card>
      </Col>

      {/* ---- Coluna de pré-visualização ---- */}
      <Col xs={24} lg={12}>
        <Card
          title="Pré-visualização"
          style={{ position: 'sticky', top: 0 }}
          extra={
            <Button size="small" icon={<PrinterOutlined />} onClick={() => printVouchers(SAMPLE, form, companyName, message.error)}>
              Testar impressão
            </Button>
          }
        >
          <iframe
            title="preview"
            srcDoc={previewDoc}
            style={{ width: '100%', height: 360, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, background: '#e9eef5' }}
          />
          <Button
            type="primary" size="large" block style={{ marginTop: 16 }}
            loading={update.isPending} onClick={handleSave}
          >
            Salvar personalização
          </Button>
        </Card>
      </Col>
    </Row>
  )
}
