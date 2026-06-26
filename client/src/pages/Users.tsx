import { useState } from 'react'
import {
  Button, Table, Modal, Form, Input, Select,
  Popconfirm, message, Typography, Tag, Grid, Switch,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { isAxiosError } from 'axios'
import { useUsers, useCreateManager, useCreateSeller, useDeactivateUser, useSetGlobalReportAccess } from '../hooks/useUsers'
import { useCompanies } from '../hooks/useCompanies'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types'

export default function UsersPage() {
  const role = useAuthStore((s) => s.user?.role)
  const { data: users = [], isLoading } = useUsers()
  const { data: companies = [] } = useCompanies()
  const createManager = useCreateManager()
  const createSeller = useCreateSeller()
  const deactivateUser = useDeactivateUser()
  const setGlobalAccess = useSetGlobalReportAccess()

  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const isManager = role === 'MANAGER'
  const isMaster = role === 'MASTER'

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]))

  async function handleCreate(values: { name: string; email: string; password: string; companyId?: string }) {
    try {
      if (isMaster) {
        await createManager.mutateAsync(values)
        message.success('Gerente criado com sucesso')
      } else {
        await createSeller.mutateAsync(values as { name: string; email: string; password: string; companyId: string })
        message.success('Vendedor criado com sucesso')
      }
    } catch (err) {
      const msg = isAxiosError(err) && err.response?.data?.message
      message.error(msg || (isMaster ? 'Erro ao criar gerente' : 'Erro ao criar vendedor'))
      return
    }
    setModalOpen(false)
    form.resetFields()
  }

  async function handleDeactivate(id: string) {
    await deactivateUser.mutateAsync(id)
    message.success('Usuário desativado')
  }

  async function handleToggleGlobal(id: string, canView: boolean) {
    try {
      await setGlobalAccess.mutateAsync({ id, canView })
      message.success(canView ? 'Acesso ao relatório geral concedido' : 'Acesso ao relatório geral revogado')
    } catch {
      message.error('Não foi possível atualizar o acesso')
    }
  }

  const columns = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'E-mail', dataIndex: 'email', key: 'email' },
    {
      title: 'Papel',
      dataIndex: 'role',
      key: 'role',
      render: (r: string) => {
        const colors: Record<string, string> = { MASTER: 'red', MANAGER: 'blue', SELLER: 'green' }
        const labels: Record<string, string> = { MASTER: 'Master', MANAGER: 'Gerente', SELLER: 'Vendedor' }
        return <Tag color={colors[r]}>{labels[r]}</Tag>
      },
    },
    ...(isManager
      ? [{
          title: 'Empresa',
          dataIndex: 'companyId',
          key: 'companyId',
          render: (id?: string) => id ? companyMap[id] ?? '—' : '—',
        }]
      : []),
    ...(isMaster
      ? [{
          title: 'Relatório geral',
          key: 'globalReports',
          render: (_: unknown, record: User) => (
            <Switch
              size="small"
              checked={!!record.canViewGlobalReports}
              loading={setGlobalAccess.isPending}
              onChange={(checked) => handleToggleGlobal(record.id, checked)}
            />
          ),
        }]
      : []),
    {
      title: 'Criado em',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleDateString('pt-BR'),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: unknown, record: User) => (
        <Popconfirm title="Desativar este usuário?" onConfirm={() => handleDeactivate(record.id)}>
          <Button size="small" danger>Desativar</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {isMaster ? 'Gerentes' : 'Vendedores'}
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} block={isMobile}>
          {isMaster ? 'Novo Gerente' : 'Novo Vendedor'}
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={users}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={isMaster ? 'Novo Gerente' : 'Novo Vendedor'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={createManager.isPending || createSeller.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          {isManager && (
            <Form.Item name="companyId" label="Empresa" rules={[{ required: true }]}>
              <Select
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione a empresa"
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
