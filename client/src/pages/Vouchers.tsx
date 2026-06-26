import { useEffect, useState } from 'react'
import {
  Button, Table, Select, InputNumber, Tag, Popconfirm,
  message, Typography, Space, Row, Col, Card, Divider, Grid,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PrinterOutlined, ThunderboltOutlined, StopOutlined, CloudDownloadOutlined,
  WifiOutlined, ClockCircleOutlined, DollarOutlined,
} from '@ant-design/icons'
import StatCard, { GRADIENTS } from '../components/StatCard'
import { usePlans } from '../hooks/usePlans'
import { useVouchers, useGenerateVouchers, useCancelVoucher } from '../hooks/useVouchers'
import { useCompanyStore } from '../store/companyStore'
import { useCompanies } from '../hooks/useCompanies'
import { useAuthStore } from '../store/authStore'
import ImportVouchersModal from '../components/ImportVouchersModal'
import { useVoucherTemplate } from '../hooks/useVoucherTemplate'
import { printVouchers, DEFAULT_TEMPLATE } from '../utils/voucherPrint'
import type { Voucher } from '../types'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  CANCELLED: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'orange',
  ACTIVE: 'green',
  EXPIRED: 'default',
  CANCELLED: 'red',
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatCode(code: string) {
  return code.replace(/(\d{4})(?=\d)/g, '$1 ')
}

export default function VouchersPage() {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const user = useAuthStore((s) => s.user)
  const isSeller = user?.role === 'SELLER'

  const { selectedCompanyId } = useCompanyStore()
  const { data: companies = [] } = useCompanies()
  const [planId, setPlanId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [planFilter, setPlanFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Voucher[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Volta para a primeira página ao trocar de empresa ou de filtro.
  useEffect(() => {
    setPage(1)
  }, [selectedCompanyId, statusFilter, planFilter])

  const { data: plans = [] } = usePlans(selectedCompanyId)
  const { data: vouchers = [], isLoading } = useVouchers({
    companyId: selectedCompanyId,
    status: statusFilter,
    planId: planFilter,
  })
  const { data: template } = useVoucherTemplate(selectedCompanyId)
  const generate = useGenerateVouchers()
  const cancel = useCancelVoucher()

  const companyName = companies.find((c) => c.id === selectedCompanyId)?.name ?? ''
  const tpl = template ?? DEFAULT_TEMPLATE

  function print(list: Voucher[]) {
    printVouchers(list, tpl, companyName, message.error)
  }

  async function handleGenerate() {
    if (!planId) { message.warning('Selecione um plano'); return }
    try {
      const created = await generate.mutateAsync({ planId, quantity })
      message.success(`${created.length} voucher(s) gerado(s)`)
      setSelected(created)
    } catch {
      message.error('Erro ao gerar vouchers')
    }
  }

  async function handleCancel(id: string) {
    await cancel.mutateAsync(id)
    message.success('Voucher cancelado')
  }

  const stats = {
    total: vouchers.length,
    pending: vouchers.filter((v) => v.status === 'PENDING').length,
    active: vouchers.filter((v) => v.status === 'ACTIVE').length,
    revenue: vouchers
      .filter((v) => v.sale)
      .reduce((sum, v) => sum + Number(v.sale!.amount), 0),
  }

  const columns: ColumnsType<Voucher> = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Typography.Text code copyable style={{ fontSize: 15, letterSpacing: 1 }}>
          {formatCode(code)}
        </Typography.Text>
      ),
    },
    {
      title: 'Plano',
      key: 'plan',
      render: (_, r) => `${r.plan.name} (${fmtDuration(r.plan.timeLimitMinutes)})`,
    },
    {
      title: 'Preço',
      key: 'price',
      render: (_, r) => `R$ ${Number(r.plan.price).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
    },
    ...(!isSeller ? [{
      title: 'Vendedor',
      key: 'seller',
      render: (_: unknown, r: Voucher) => r.createdBy.name,
    }] : []),
    {
      title: 'Gerado em',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      render: fmtDate,
    },
    {
      title: 'Ativado em',
      dataIndex: 'activatedAt',
      key: 'activatedAt',
      render: fmtDate,
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => print([r])}
          />
          {!isSeller && r.status === 'PENDING' && (
            <Popconfirm title="Cancelar e deletar este voucher?" onConfirm={() => handleCancel(r.id)}>
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      {/* Área de geração */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={8} lg={7}>
            <Select
              style={{ width: '100%' }}
              placeholder="Plano"
              value={planId}
              onChange={setPlanId}
              disabled={!selectedCompanyId}
              options={plans.map((p) => ({
                value: p.id,
                label: `${p.name} — R$ ${Number(p.price).toFixed(2)}`,
              }))}
            />
          </Col>
          <Col xs={12} sm={6} md={5} lg={4}>
            <InputNumber
              min={1} max={100}
              value={quantity}
              onChange={(v) => setQuantity(v ?? 1)}
              addonBefore="Qtd"
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={12} sm={6} md={4} lg={3}>
            <Button
              type="primary"
              block
              icon={<ThunderboltOutlined />}
              loading={generate.isPending}
              onClick={handleGenerate}
              disabled={!planId}
            >
              Gerar
            </Button>
          </Col>
          {!isMobile && <Col flex="auto" />}
          <Col xs={24} sm={selected.length > 0 ? 12 : 24} md="auto">
            <Button
              block={isMobile}
              icon={<CloudDownloadOutlined />}
              onClick={() => setImportOpen(true)}
              disabled={!selectedCompanyId}
            >
              Importar da controladora
            </Button>
          </Col>
          {selected.length > 0 && (
            <Col xs={24} sm={12} md="auto">
              <Button
                block={isMobile}
                icon={<PrinterOutlined />}
                onClick={() => print(selected)}
              >
                Imprimir {selected.length} selecionado(s)
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Estatísticas */}
      {selectedCompanyId && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} xl={6}><StatCard title="Total" value={stats.total} icon={<WifiOutlined />} gradient={GRADIENTS.blue} /></Col>
          <Col xs={12} xl={6}><StatCard title="Pendentes" value={stats.pending} icon={<ClockCircleOutlined />} gradient={GRADIENTS.orange} /></Col>
          <Col xs={12} xl={6}><StatCard title="Ativos" value={stats.active} icon={<ThunderboltOutlined />} gradient={GRADIENTS.green} /></Col>
          <Col xs={12} xl={6}><StatCard title="Receita" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<DollarOutlined />} gradient={GRADIENTS.purple} /></Col>
        </Row>
      )}

      {/* Filtros + tabela */}
      <Card>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12,
          justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <Typography.Title level={5} style={{ margin: 0 }}>Vouchers</Typography.Title>
          <Space wrap>
            <Select
              style={{ width: 200 }}
              placeholder="Filtrar por plano"
              allowClear
              showSearch
              optionFilterProp="label"
              value={planFilter}
              onChange={setPlanFilter}
              disabled={!selectedCompanyId}
              options={plans.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Select
              style={{ width: 150 }}
              placeholder="Filtrar por status"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            />
            {selected.length > 0 && (
              <>
                {!isMobile && <Divider type="vertical" />}
                <Button icon={<PrinterOutlined />} onClick={() => print(selected)}>
                  Imprimir selecionados ({selected.length})
                </Button>
                <Button onClick={() => setSelected([])}>Limpar seleção</Button>
              </>
            )}
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={vouchers}
          columns={columns}
          scroll={{ x: 'max-content' }}
          rowSelection={{
            preserveSelectedRowKeys: true,
            selectedRowKeys: selected.map((v) => v.id),
            onChange: (_, rows) => setSelected(rows),
          }}
          locale={{ emptyText: selectedCompanyId ? 'Nenhum voucher encontrado' : 'Selecione uma empresa na barra lateral' }}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            // onChange recebe (página, tamanho) tanto ao paginar quanto ao
            // trocar o tamanho — por isso o tamanho não ficava mais preso em 50.
            onChange: (p, ps) => {
              setPage(ps !== pageSize ? 1 : p)
              setPageSize(ps)
            },
            showTotal: (t) => `${t} vouchers`,
          }}
        />
      </Card>

      <ImportVouchersModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        companyId={selectedCompanyId}
      />
    </>
  )
}
