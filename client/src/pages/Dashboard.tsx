import { useState } from 'react'
import { Row, Col, Card, Typography, Empty, Button, Space } from 'antd'
import {
  WifiOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useCompanyStore } from '../store/companyStore'
import { useAuthStore } from '../store/authStore'
import { useVouchers } from '../hooks/useVouchers'
import StatCard, { GRADIENTS } from '../components/StatCard'
import RevenueChart, { type RevenuePoint } from '../components/RevenueChart'
import type { Voucher } from '../types'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function monthLabel(m: Dayjs) {
  return `${MESES[m.month()]} de ${m.year()}`
}

// Receita por dia do mês selecionado (1 ponto por dia do mês).
function buildRevenueSeries(vouchers: Voucher[], month: Dayjs): RevenuePoint[] {
  const days = month.daysInMonth()
  const mm = String(month.month() + 1).padStart(2, '0')
  const buckets = new Array(days).fill(0)

  for (const v of vouchers) {
    if (!v.sale) continue
    const d = dayjs(v.sale.registeredAt)
    if (d.isSame(month, 'month')) buckets[d.date() - 1] += Number(v.sale.amount)
  }

  return buckets.map((value, i) => ({
    label: `${String(i + 1).padStart(2, '0')}/${mm}`,
    value: Number(value.toFixed(2)),
  }))
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { selectedCompanyId } = useCompanyStore()
  const { data: vouchers = [] } = useVouchers({ companyId: selectedCompanyId })

  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const isCurrentMonth = month.isSame(dayjs(), 'month')

  // Vouchers gerados no mês selecionado alimentam os contadores;
  // a receita usa a data da venda (registeredAt), conforme a regra de negócio.
  const monthVouchers = vouchers.filter((v) => dayjs(v.generatedAt).isSame(month, 'month'))

  const stats = {
    // Vouchers e receita são do mês selecionado.
    total: monthVouchers.length,
    revenue: vouchers
      .filter((v) => v.sale && dayjs(v.sale.registeredAt).isSame(month, 'month'))
      .reduce((s, v) => s + Number(v.sale!.amount), 0),
    // Pendentes/Ativos são sempre ao vivo (status atual de todos os vouchers).
    pending: vouchers.filter((v) => v.status === 'PENDING').length,
    active: vouchers.filter((v) => v.status === 'ACTIVE').length,
  }
  const series = buildRevenueSeries(vouchers, month)

  return (
    <>
      <Typography.Title level={3} style={{ color: '#fff', marginTop: 0 }}>
        Olá, {user?.name?.split(' ')[0] ?? ''} 👋
      </Typography.Title>
      <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.55)', marginTop: -8 }}>
        Visão geral da operação.
      </Typography.Paragraph>

      {!selectedCompanyId ? (
        <Card>
          <Empty description={<span style={{ color: 'rgba(255,255,255,0.6)' }}>Selecione uma empresa na barra lateral</span>} />
        </Card>
      ) : (
        <>
          <Space align="center" size={12} style={{ marginBottom: 16 }}>
            <Button
              icon={<LeftOutlined />}
              onClick={() => setMonth((m) => m.subtract(1, 'month'))}
              aria-label="Mês anterior"
            />
            <Typography.Text strong style={{ color: '#fff', fontSize: 16, minWidth: 160, textAlign: 'center', display: 'inline-block' }}>
              {monthLabel(month)}
            </Typography.Text>
            <Button
              icon={<RightOutlined />}
              onClick={() => setMonth((m) => m.add(1, 'month'))}
              disabled={isCurrentMonth}
              aria-label="Próximo mês"
            />
            {!isCurrentMonth && (
              <Button type="link" onClick={() => setMonth(dayjs().startOf('month'))} style={{ padding: 0 }}>
                Mês atual
              </Button>
            )}
          </Space>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Vouchers no mês" value={stats.total} icon={<WifiOutlined />} gradient={GRADIENTS.blue} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Pendentes" value={stats.pending} icon={<ClockCircleOutlined />} gradient={GRADIENTS.orange} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Ativos" value={stats.active} icon={<ThunderboltOutlined />} gradient={GRADIENTS.green} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Receita do mês" value={`R$ ${stats.revenue.toFixed(2)}`} icon={<DollarOutlined />} gradient={GRADIENTS.purple} />
            </Col>
          </Row>

          <Card style={{ marginTop: 16 }} title={`Receita — ${monthLabel(month)}`}>
            <RevenueChart data={series} />
          </Card>
        </>
      )}
    </>
  )
}
