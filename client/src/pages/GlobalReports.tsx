import { useState } from 'react'
import {
  Card, Row, Col, Table, Typography, Empty, Spin, Button, DatePicker, Space,
  Tag, Alert, Tooltip, Progress,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DollarOutlined, ShoppingCartOutlined, TagOutlined, ShopOutlined,
  BulbOutlined, RobotOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import StatCard, { GRADIENTS } from '../components/StatCard'
import RevenueChart, { type RevenuePoint } from '../components/RevenueChart'
import MarkdownLite from '../components/MarkdownLite'
import { useAuthStore } from '../store/authStore'
import { useGlobalReport, useGlobalReportInsights } from '../hooks/useReports'
import type { GlobalCompanyPoint } from '../types'

const { RangePicker } = DatePicker

function fmtCurrency(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GlobalReportsPage() {
  const user = useAuthStore((s) => s.user)
  const canAccess = user?.role === 'MASTER' || !!user?.canViewGlobalReports

  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day').startOf('day'),
    dayjs().endOf('day'),
  ])
  const apiRange = { from: range[0].toISOString(), to: range[1].toISOString() }

  const { data: report, isLoading } = useGlobalReport(apiRange, canAccess)
  const insights = useGlobalReportInsights()

  function handleGenerate() {
    insights.reset()
    insights.mutate(apiRange)
  }

  if (!canAccess) {
    return <Empty description="Você não tem acesso ao relatório geral" />
  }

  // Participação de cada embarcação no total de vendas da frota.
  const maxSales = Math.max(1, ...(report?.byCompany ?? []).map((c) => c.salesCount))
  const totalSales = report?.summary.salesCount ?? 0

  const companyColumns: ColumnsType<GlobalCompanyPoint> = [
    {
      title: '#',
      key: 'rank',
      width: 48,
      render: (_, _r, i) => <Typography.Text strong>{i + 1}</Typography.Text>,
    },
    {
      title: 'Embarcação',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, r) => (
        <Space size={6}>
          <span>{name}</span>
          {r.hasActiveTrip && <Tag color="green">viagem aberta</Tag>}
        </Space>
      ),
    },
    {
      title: 'Vendas',
      dataIndex: 'salesCount',
      key: 'salesCount',
      width: 160,
      render: (v: number) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Typography.Text strong>{v}</Typography.Text>
          <Progress percent={Math.round((v / maxSales) * 100)} showInfo={false} size="small" strokeColor="#21a9ff" />
        </Space>
      ),
    },
    {
      title: 'Participação',
      key: 'share',
      width: 100,
      align: 'right',
      render: (_, r) => `${totalSales > 0 ? ((r.salesCount / totalSales) * 100).toFixed(1) : '0.0'}%`,
    },
    {
      title: 'Viagens',
      dataIndex: 'tripsWithSales',
      key: 'tripsWithSales',
      width: 90,
      align: 'right',
    },
    {
      title: 'Ticket médio',
      dataIndex: 'avgTicket',
      key: 'avgTicket',
      width: 120,
      align: 'right',
      render: (v: number) => fmtCurrency(v),
    },
    {
      title: 'Receita',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 130,
      align: 'right',
      render: (v: number) => <Typography.Text strong style={{ color: '#52c41a' }}>{fmtCurrency(v)}</Typography.Text>,
    },
  ]

  const daySeries: RevenuePoint[] = (report?.byDay ?? []).map((d) => {
    const [, m, day] = d.date.split('-')
    return { label: `${day}/${m}`, value: d.revenue }
  })

  const insightsErr = insights.error as { response?: { status?: number; data?: { message?: string } } } | null

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card styles={{ body: { padding: 16 } }}>
        <Space wrap align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space wrap>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.6)' }}>Período:</Typography.Text>
            <RangePicker
              value={range}
              format="DD/MM/YYYY"
              allowClear={false}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0].startOf('day'), v[1].endOf('day')])}
              presets={[
                { label: 'Últimos 7 dias', value: [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] },
                { label: 'Últimos 30 dias', value: [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')] },
                { label: 'Este mês', value: [dayjs().startOf('month'), dayjs().endOf('day')] },
                { label: 'Últimos 90 dias', value: [dayjs().subtract(90, 'day').startOf('day'), dayjs().endOf('day')] },
              ]}
            />
          </Space>
          <Tooltip title={report && !report.aiAvailable ? 'Configure OPENAI_API_KEY no servidor' : undefined}>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              loading={insights.isPending}
              disabled={!report || !report.aiAvailable || report.summary.salesCount === 0}
              onClick={handleGenerate}
            >
              Gerar insights com IA
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {isLoading && <Spin />}

      {report && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} xl={6}>
              <StatCard title="Vendas (frota)" value={report.summary.salesCount} icon={<ShoppingCartOutlined />} gradient={GRADIENTS.blue} />
            </Col>
            <Col xs={12} xl={6}>
              <StatCard title="Receita (frota)" value={fmtCurrency(report.summary.totalRevenue)} icon={<DollarOutlined />} gradient={GRADIENTS.green} />
            </Col>
            <Col xs={12} xl={6}>
              <StatCard title="Ticket médio" value={fmtCurrency(report.summary.avgTicket)} icon={<TagOutlined />} gradient={GRADIENTS.purple} />
            </Col>
            <Col xs={12} xl={6}>
              <StatCard
                title="Embarcações vendendo"
                value={`${report.summary.sellingCompanies}/${report.summary.totalCompanies}`}
                icon={<ShopOutlined />}
                gradient={GRADIENTS.orange}
              />
            </Col>
          </Row>

          <Card title="Ranking de embarcações por vendas">
            {report.byCompany.length > 0 ? (
              <Table
                rowKey="id"
                size="small"
                dataSource={report.byCompany}
                columns={companyColumns}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            ) : (
              <Empty description="Nenhuma embarcação cadastrada" />
            )}
          </Card>

          <Card title="Receita por dia (frota)">
            {daySeries.length > 0 ? <RevenueChart data={daySeries} /> : <Empty description="Sem vendas no período" />}
          </Card>

          <Card title={<span><BulbOutlined style={{ marginRight: 8 }} />Insights de IA</span>}>
            {insights.isPending && <Spin tip="Analisando a frota..."><div style={{ height: 60 }} /></Spin>}
            {insightsErr && (
              <Alert
                type={insightsErr.response?.status === 503 ? 'warning' : 'error'}
                showIcon
                message={insightsErr.response?.data?.message ?? 'Não foi possível gerar os insights.'}
              />
            )}
            {insights.data && (
              <>
                <MarkdownLite text={insights.data.insights} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Gerado por IA em {dayjs(insights.data.generatedAt).format('DD/MM/YYYY HH:mm')} · revise antes de decisões.
                </Typography.Text>
              </>
            )}
            {!insights.isPending && !insights.data && !insightsErr && (
              <Typography.Text type="secondary">
                Clique em “Gerar insights com IA” para uma análise da frota no período selecionado.
              </Typography.Text>
            )}
          </Card>
        </>
      )}
    </Space>
  )
}
