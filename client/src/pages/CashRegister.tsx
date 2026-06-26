import { useState } from 'react'
import {
  Card, Row, Col, Button, Table, Tag,
  Modal, Typography, Collapse, Empty, Spin, message, Descriptions, Popconfirm,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  LockOutlined, HistoryOutlined, DollarOutlined,
  WifiOutlined, ClockCircleOutlined, ShoppingCartOutlined, DeleteOutlined,
} from '@ant-design/icons'
import StatCard, { GRADIENTS } from '../components/StatCard'
import { useAuthStore } from '../store/authStore'
import { useCompanyStore } from '../store/companyStore'
import { useActiveTrip, useTripHistory, useCloseTrip } from '../hooks/useTrips'
import { useTripSales, useRemoveSale } from '../hooks/useSales'
import type { Sale, Trip } from '../types'

function fmtDate(iso?: string | null, opts?: { time?: boolean }) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: opts?.time !== false ? 'short' : undefined,
  })
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtSince(iso: string) {
  const totalMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatCode(code: string) {
  return code.replace(/(\d{4})(?=\d)/g, '$1 ')
}

const salesColumns: ColumnsType<Sale> = [
  {
    title: 'Hora',
    dataIndex: 'registeredAt',
    key: 'registeredAt',
    width: 130,
    render: (v: string) => fmtDate(v),
  },
  {
    title: 'Código',
    key: 'code',
    render: (_, r) => (
      <Typography.Text code>{formatCode(r.voucher.code)}</Typography.Text>
    ),
  },
  {
    title: 'Plano',
    key: 'plan',
    render: (_, r) =>
      r.voucher.plan.timeLimitMinutes
        ? `${r.voucher.plan.name} (${fmtDuration(r.voucher.plan.timeLimitMinutes)})`
        : r.voucher.plan.name,
  },
  {
    title: 'Vendedor',
    key: 'seller',
    render: (_, r) => r.seller.name,
  },
  {
    title: 'Valor',
    dataIndex: 'amount',
    key: 'amount',
    align: 'right' as const,
    render: (v: number) => (
      <Typography.Text strong style={{ color: '#52c41a' }}>
        {fmtCurrency(Number(v))}
      </Typography.Text>
    ),
  },
]

function TripHistoryItem({ trip }: { trip: Trip }) {
  const { data, isLoading } = useTripSales(trip.id)

  return (
    <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
      <Descriptions.Item label="Abertura">{fmtDate(trip.openedAt)}</Descriptions.Item>
      <Descriptions.Item label="Fechamento">{fmtDate(trip.closedAt)}</Descriptions.Item>
      <Descriptions.Item label="Receita">
        <Typography.Text strong style={{ color: '#1677ff' }}>
          {fmtCurrency(Number(trip.totalRevenue))}
        </Typography.Text>
      </Descriptions.Item>
      <Descriptions.Item label="Vendas">{trip._count.sales}</Descriptions.Item>
      {isLoading ? (
        <Descriptions.Item label="Detalhes"><Spin size="small" /></Descriptions.Item>
      ) : data && data.sales.length > 0 ? (
        <Descriptions.Item label="" span={2}>
          <Table
            rowKey="id"
            size="small"
            dataSource={data.sales}
            columns={salesColumns}
            scroll={{ x: 'max-content' }}
            pagination={false}
            style={{ marginTop: 8 }}
          />
        </Descriptions.Item>
      ) : null}
    </Descriptions>
  )
}

export default function CashRegisterPage() {
  const { selectedCompanyId } = useCompanyStore()
  // SELLER vê o caixa completo, mas fechar caixa é do gerente/master
  const isSeller = useAuthStore((s) => s.user?.role === 'SELLER')
  // Remover venda do caixa (apaga a venda + cancela o voucher) é exclusivo do MASTER
  const isMaster = useAuthStore((s) => s.user?.role === 'MASTER')
  const [closeModal, setCloseModal] = useState(false)

  const { data: activeTrip, isLoading: loadingTrip } = useActiveTrip(selectedCompanyId)
  const { data: history = [] } = useTripHistory(selectedCompanyId)
  const { data: salesData, isLoading: loadingSales } = useTripSales(activeTrip?.id ?? null)
  const closeTrip = useCloseTrip()
  const removeSale = useRemoveSale()

  async function handleRemoveSale(id: string) {
    try {
      await removeSale.mutateAsync(id)
      message.success('Venda removida do caixa e voucher cancelado.')
    } catch {
      message.error('Não foi possível remover a venda.')
    }
  }

  // Tabela da viagem atual ganha coluna de ação só para o MASTER.
  const activeSalesColumns: ColumnsType<Sale> = isMaster
    ? [
        ...salesColumns,
        {
          title: 'Ação',
          key: 'action',
          width: 80,
          align: 'center' as const,
          render: (_, r) => (
            <Popconfirm
              title="Remover venda do caixa"
              description="A venda sai da receita e o voucher é cancelado. Não dá para desfazer."
              okText="Remover"
              cancelText="Cancelar"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleRemoveSale(r.id)}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          ),
        },
      ]
    : salesColumns

  const pendingVouchers = activeTrip
    ? Math.max(0, activeTrip._count.vouchers - activeTrip._count.sales)
    : 0

  async function handleClose() {
    if (!selectedCompanyId) return
    await closeTrip.mutateAsync(selectedCompanyId)
    message.success('Caixa fechado! Nova viagem iniciada.')
    setCloseModal(false)
  }

  const closedTrips = history.filter((t) => !t.active)
  const tripNumber = closedTrips.length + 1

  if (!selectedCompanyId) {
    return <Empty description="Selecione uma empresa na barra lateral" />
  }

  return (
    <>
      {loadingTrip && <Spin />}

      {!loadingTrip && !activeTrip && (
        <Empty description="Nenhuma viagem ativa" />
      )}

      {activeTrip && (
        <div className="cash-open">
          {/* Banner de status da viagem aberta */}
          <div className="cash-open-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
              <Tag
                color="success"
                style={{
                  margin: 0,
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span className="pulse-dot" />
                CAIXA ABERTO
              </Tag>
              <div>
                <Typography.Text strong style={{ fontSize: 16, color: '#fff' }}>
                  Viagem #{tripNumber}
                </Typography.Text>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                  Aberta em {fmtDate(activeTrip.openedAt)} · há {fmtSince(activeTrip.openedAt)}
                </div>
              </div>
            </div>
            {!isSeller && (
              <Button type="primary" danger icon={<LockOutlined />} onClick={() => setCloseModal(true)}>
                Fechar Caixa
              </Button>
            )}
          </div>

          {/* KPIs da viagem atual */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} xl={6}>
              <StatCard title="Receita" value={fmtCurrency(Number(activeTrip.totalRevenue))} icon={<DollarOutlined />} gradient={GRADIENTS.green} />
            </Col>
            <Col xs={12} xl={6}>
              <StatCard title="Vendas realizadas" value={activeTrip._count.sales} icon={<ShoppingCartOutlined />} gradient={GRADIENTS.blue} />
            </Col>
            <Col xs={12} xl={6}>
              <StatCard title="Vouchers gerados" value={activeTrip._count.vouchers} icon={<WifiOutlined />} gradient={GRADIENTS.purple} />
            </Col>
            <Col xs={12} xl={6}>
              <StatCard title="Aguardando conexão" value={pendingVouchers} icon={<ClockCircleOutlined />} gradient={GRADIENTS.orange} />
            </Col>
          </Row>

          {/* Vendas da viagem atual */}
          <Card
            title="Vendas da viagem atual"
            extra={salesData && <Tag color="blue">Total: {fmtCurrency(salesData.total)}</Tag>}
          >
            <Table
              rowKey="id"
              loading={loadingSales}
              dataSource={salesData?.sales ?? []}
              columns={activeSalesColumns}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 20, showTotal: (t) => `${t} vendas` }}
              locale={{ emptyText: 'Nenhuma venda registrada ainda' }}
            />
          </Card>
        </div>
      )}

      {/* Histórico */}
      {closedTrips.length > 0 && (
        <Card title={<span><HistoryOutlined style={{ marginRight: 8 }} />Histórico de Viagens</span>}>
          <Collapse
            accordion
            items={closedTrips.map((trip, i) => ({
              key: trip.id,
              label: (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '4px 12px',
                  justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', paddingRight: 24,
                }}>
                  <span>
                    Viagem #{closedTrips.length - i} —{' '}
                    {fmtDate(trip.openedAt, { time: false })} até {fmtDate(trip.closedAt, { time: false })}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <Tag color="blue">{fmtCurrency(Number(trip.totalRevenue))}</Tag>
                    <Tag>{trip._count.sales} vendas</Tag>
                  </span>
                </div>
              ),
              children: <TripHistoryItem trip={trip} />,
            }))}
          />
        </Card>
      )}

      {/* Modal: confirmar fechamento */}
      <Modal
        title={<span><LockOutlined style={{ marginRight: 8 }} />Fechar Caixa</span>}
        open={closeModal}
        onCancel={() => setCloseModal(false)}
        onOk={handleClose}
        confirmLoading={closeTrip.isPending}
        okText="Confirmar Fechamento"
        okButtonProps={{ danger: true }}
        cancelText="Cancelar"
      >
        {activeTrip && (
          <>
            <Descriptions column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Abertura">{fmtDate(activeTrip.openedAt)}</Descriptions.Item>
              <Descriptions.Item label="Receita total">
                <Typography.Text strong style={{ color: '#52c41a' }}>
                  {fmtCurrency(Number(activeTrip.totalRevenue))}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Vendas">{activeTrip._count.sales}</Descriptions.Item>
              <Descriptions.Item label="Pendentes">{pendingVouchers}</Descriptions.Item>
            </Descriptions>
            <Typography.Text type="secondary">
              Os vouchers ainda não utilizados permanecerão válidos.
              Uma nova viagem será aberta automaticamente.
            </Typography.Text>
          </>
        )}
      </Modal>
    </>
  )
}
