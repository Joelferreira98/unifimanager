import { useState } from 'react'
import { Row, Col, Card, Typography, Empty, Button, Space, Spin } from 'antd'
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
import { useDashboardSummary } from '../hooks/useDashboard'
import StatCard, { GRADIENTS } from '../components/StatCard'
import RevenueChart, { type RevenuePoint } from '../components/RevenueChart'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function monthLabel(m: Dayjs) {
  return `${MESES[m.month()]} de ${m.year()}`
}

// Receita por dia do mês selecionado (1 ponto por dia, preenchendo zeros).
function buildRevenueSeries(byDay: { date: string; revenue: number }[], month: Dayjs): RevenuePoint[] {
  const days = month.daysInMonth()
  const ym = month.format('YYYY-MM')
  const mm = String(month.month() + 1).padStart(2, '0')
  const map = new Map(byDay.map((d) => [d.date, d.revenue]))

  return Array.from({ length: days }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0')
    return {
      label: `${dd}/${mm}`,
      value: Number((map.get(`${ym}-${dd}`) ?? 0).toFixed(2)),
    }
  })
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { selectedCompanyId } = useCompanyStore()

  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const isCurrentMonth = month.isSame(dayjs(), 'month')

  const range = { from: month.startOf('month').toISOString(), to: month.endOf('month').toISOString() }
  const { data: summary, isLoading } = useDashboardSummary(selectedCompanyId, range)

  const series = buildRevenueSeries(summary?.byDay ?? [], month)

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
            {isLoading && <Spin size="small" />}
          </Space>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Vouchers no mês" value={summary?.total ?? 0} icon={<WifiOutlined />} gradient={GRADIENTS.blue} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Pendentes" value={summary?.pending ?? 0} icon={<ClockCircleOutlined />} gradient={GRADIENTS.orange} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Ativos" value={summary?.active ?? 0} icon={<ThunderboltOutlined />} gradient={GRADIENTS.green} />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard title="Receita do mês" value={`R$ ${(summary?.revenue ?? 0).toFixed(2)}`} icon={<DollarOutlined />} gradient={GRADIENTS.purple} />
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
