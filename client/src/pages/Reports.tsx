import { useState } from 'react'
import {
  Card, Row, Col, Table, Typography, Empty, Spin, Button, DatePicker, Space,
  Tag, Alert, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DollarOutlined, ShoppingCartOutlined, TagOutlined,
  BulbOutlined, RobotOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import StatCard, { GRADIENTS } from '../components/StatCard'
import RevenueChart, { type RevenuePoint } from '../components/RevenueChart'
import MarkdownLite from '../components/MarkdownLite'
import { useCompanyStore } from '../store/companyStore'
import { useCompanyReport, useReportInsights } from '../hooks/useReports'
import type { ReportBreakdownItem, ReportTripPoint } from '../types'

const { RangePicker } = DatePicker

function fmtCurrency(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtShortDate(iso: string) {
  return dayjs(iso).format('DD/MM/YY')
}

// Variação % vs. viagem anterior, como Tag colorido.
function VarTag({ curr, prev }: { curr: number; prev: number | null }) {
  if (prev === null) return <Typography.Text type="secondary">—</Typography.Text>
  if (prev === 0) return <Tag color={curr > 0 ? 'green' : 'default'}>{curr > 0 ? 'novo' : '0%'}</Tag>
  const v = ((curr - prev) / prev) * 100
  const color = v > 0 ? 'green' : v < 0 ? 'red' : 'default'
  return <Tag color={color}>{`${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}</Tag>
}

const tripColumns: ColumnsType<ReportTripPoint & { prevRevenue: number | null }> = [
  { title: 'Viagem', key: 'number', width: 90, render: (_, r) => `#${r.number}${r.active ? ' (aberta)' : ''}` },
  { title: 'Abertura', key: 'openedAt', width: 100, render: (_, r) => fmtShortDate(r.openedAt) },
  { title: 'Vendas', dataIndex: 'salesCount', key: 'salesCount', width: 80, align: 'right' },
  { title: 'Ticket médio', dataIndex: 'avgTicket', key: 'avgTicket', width: 120, align: 'right', render: (v: number) => fmtCurrency(v) },
  {
    title: 'Receita',
    dataIndex: 'revenue',
    key: 'revenue',
    width: 130,
    align: 'right',
    render: (v: number) => <Typography.Text strong style={{ color: '#52c41a' }}>{fmtCurrency(v)}</Typography.Text>,
  },
  { title: 'vs. anterior', key: 'var', width: 100, align: 'right', render: (_, r) => <VarTag curr={r.revenue} prev={r.prevRevenue} /> },
]

const breakdownColumns = (label: string): ColumnsType<ReportBreakdownItem> => [
  { title: label, dataIndex: 'name', key: 'name', ellipsis: true },
  { title: 'Vendas', dataIndex: 'salesCount', key: 'salesCount', width: 90, align: 'right' },
  {
    title: 'Receita',
    dataIndex: 'revenue',
    key: 'revenue',
    width: 130,
    align: 'right',
    render: (v: number) => (
      <Typography.Text strong style={{ color: '#52c41a' }}>{fmtCurrency(v)}</Typography.Text>
    ),
  },
]

export default function ReportsPage() {
  const { selectedCompanyId } = useCompanyStore()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')])

  const apiRange = { from: range[0].toISOString(), to: range[1].toISOString() }
  const { data: report, isLoading } = useCompanyReport(selectedCompanyId, apiRange)
  const insights = useReportInsights(selectedCompanyId)

  function handleGenerate() {
    insights.reset()
    insights.mutate(apiRange)
  }

  if (!selectedCompanyId) {
    return <Empty description="Selecione uma empresa na barra lateral" />
  }

  const series: RevenuePoint[] = (report?.byDay ?? []).map((d) => {
    const [, m, day] = d.date.split('-')
    return { label: `${day}/${m}`, value: d.revenue }
  })

  const tripSeries: RevenuePoint[] = (report?.byTrip ?? []).map((t) => ({ label: `#${t.number}`, value: t.revenue }))
  const tripRows = (report?.byTrip ?? []).map((t, i, arr) => ({
    ...t,
    prevRevenue: i > 0 ? arr[i - 1].revenue : null,
  }))

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
            <Col xs={24} sm={8}>
              <StatCard title="Receita" value={fmtCurrency(report.summary.totalRevenue)} icon={<DollarOutlined />} gradient={GRADIENTS.green} />
            </Col>
            <Col xs={12} sm={8}>
              <StatCard title="Vendas" value={report.summary.salesCount} icon={<ShoppingCartOutlined />} gradient={GRADIENTS.blue} />
            </Col>
            <Col xs={12} sm={8}>
              <StatCard title="Ticket médio" value={fmtCurrency(report.summary.avgTicket)} icon={<TagOutlined />} gradient={GRADIENTS.purple} />
            </Col>
          </Row>

          {/* Evolução por viagem — ciclo central do negócio */}
          <Card title="Evolução por viagem (caixa)">
            {tripSeries.length > 0 ? (
              <>
                <RevenueChart data={tripSeries} />
                <Table
                  rowKey="id"
                  size="small"
                  style={{ marginTop: 12 }}
                  dataSource={tripRows}
                  columns={tripColumns}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              </>
            ) : (
              <Empty description="Sem vendas em viagens no período" />
            )}
          </Card>

          <Card title="Receita por dia">
            {series.length > 0 ? <RevenueChart data={series} /> : <Empty description="Sem vendas no período" />}
          </Card>

          {/* Insights de IA */}
          <Card title={<span><BulbOutlined style={{ marginRight: 8 }} />Insights de IA</span>}>
            {insights.isPending && <Spin tip="Analisando os dados..."><div style={{ height: 60 }} /></Spin>}
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
                Clique em “Gerar insights com IA” para uma análise do período selecionado.
              </Typography.Text>
            )}
          </Card>

          <Card title="Por plano" extra={<Tag color="blue">{report.byPlan.length}</Tag>}>
            <Table
              rowKey="id"
              size="small"
              dataSource={report.byPlan}
              columns={breakdownColumns('Plano')}
              pagination={false}
              locale={{ emptyText: 'Sem vendas no período' }}
            />
          </Card>
        </>
      )}
    </Space>
  )
}
