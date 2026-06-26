import { useState } from 'react'
import {
  Button, Table, Modal, Form, Input, InputNumber, Select,
  Popconfirm, message, Typography, Space, Tag, Grid,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { isAxiosError } from 'axios'
import { useCompanies } from '../hooks/useCompanies'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '../hooks/usePlans'
import { useCompanyStore } from '../store/companyStore'
import type { Plan } from '../types'

function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtKbps(kbps?: number) {
  if (!kbps) return '—'
  return kbps >= 1000 ? `${kbps / 1000} Mbps` : `${kbps} Kbps`
}

export default function PlansPage() {
  const { selectedCompanyId } = useCompanyStore()
  const { data: companies = [] } = useCompanies()
  const { data: plans = [], isLoading } = usePlans(selectedCompanyId)
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()
  const deletePlan = useDeletePlan()

  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form] = Form.useForm()

  function openCreate() {
    setEditing(null)
    form.resetFields()
    if (selectedCompanyId) form.setFieldValue('companyId', selectedCompanyId)
    setModalOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditing(plan)
    form.setFieldsValue(plan)
    setModalOpen(true)
  }

  async function handleSubmit(values: Omit<Plan, 'id' | 'active' | 'createdAt'>) {
    try {
      if (editing) {
        await updatePlan.mutateAsync({ id: editing.id, ...values })
        message.success('Plano atualizado')
      } else {
        await createPlan.mutateAsync(values)
        message.success('Plano criado')
      }
    } catch (err) {
      const msg = isAxiosError(err) && err.response?.data?.message
      message.error(msg || 'Erro ao salvar plano')
      return
    }
    setModalOpen(false)
    form.resetFields()
  }

  async function handleDelete(plan: Plan) {
    await deletePlan.mutateAsync({ id: plan.id, companyId: plan.companyId })
    message.success('Plano desativado')
  }

  const columns = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    {
      title: 'Preço',
      dataIndex: 'price',
      key: 'price',
      render: (v: number) => `R$ ${Number(v).toFixed(2)}`,
    },
    {
      title: 'Duração',
      dataIndex: 'timeLimitMinutes',
      key: 'timeLimitMinutes',
      render: fmtDuration,
    },
    {
      title: 'Dados',
      dataIndex: 'dataUsageLimitMBytes',
      key: 'data',
      render: (v?: number) => v ? (v >= 1024 ? `${v / 1024} GB` : `${v} MB`) : '—',
    },
    { title: 'Download', dataIndex: 'rxRateLimitKbps', key: 'rx', render: fmtKbps },
    { title: 'Upload', dataIndex: 'txRateLimitKbps', key: 'tx', render: fmtKbps },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: unknown, record: Plan) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Desativar este plano?" onConfirm={() => handleDelete(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>Planos</Typography.Title>
          {plans.length > 0 && <Tag color="blue">{plans.length}</Tag>}
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          disabled={!selectedCompanyId}
          block={isMobile}
        >
          Novo Plano
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={plans}
        columns={columns}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: selectedCompanyId ? 'Nenhum plano cadastrado' : 'Selecione uma empresa na barra lateral' }}
        pagination={false}
      />

      <Modal
        title={editing ? 'Editar Plano' : 'Novo Plano'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createPlan.isPending || updatePlan.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {!editing && (
            <Form.Item name="companyId" label="Empresa" rules={[{ required: true }]}>
              <Select
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione a empresa"
              />
            </Form.Item>
          )}
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input placeholder="ex: 1 hora básico" />
          </Form.Item>
          <Form.Item name="price" label="Preço (R$)" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.5} precision={2} style={{ width: '100%' }} prefix="R$" />
          </Form.Item>
          <Form.Item name="timeLimitMinutes" label="Duração (minutos)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="dataUsageLimitMBytes" label="Limite de dados (MB)">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Sem limite" />
          </Form.Item>
          <Form.Item name="rxRateLimitKbps" label="Download máx (Kbps)">
            <InputNumber min={2} max={100000} style={{ width: '100%' }} placeholder="Sem limite" />
          </Form.Item>
          <Form.Item name="txRateLimitKbps" label="Upload máx (Kbps)">
            <InputNumber min={2} max={100000} style={{ width: '100%' }} placeholder="Sem limite" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
