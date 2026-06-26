import { useState } from 'react'
import {
  Button, Table, Modal, Form, Input, Select, Drawer,
  Space, Tag, Popconfirm, message, Typography, Grid,
} from 'antd'
import { PlusOutlined, TeamOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany,
  useAssignManager, useRemoveManager,
} from '../hooks/useCompanies'
import { useUsers } from '../hooks/useUsers'
import { useSites } from '../hooks/useSites'
import { useAuthStore } from '../store/authStore'
import type { Company } from '../types'

export default function CompaniesPage() {
  const { data: companies = [], isLoading } = useCompanies()
  const { data: sites = [] } = useSites()
  const { data: allUsers = [] } = useUsers()
  const createCompany = useCreateCompany()
  const updateCompany = useUpdateCompany()
  const deleteCompany = useDeleteCompany()
  const assignManager = useAssignManager()
  const removeManager = useRemoveManager()
  const role = useAuthStore((s) => s.user?.role)

  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [managersCompany, setManagersCompany] = useState<Company | null>(null)
  const [form] = Form.useForm()

  function openCreate() {
    setEditing(null)
    form.resetFields()
    setFormOpen(true)
  }

  function openEdit(company: Company) {
    setEditing(company)
    form.setFieldsValue({ name: company.name, unifiSiteId: company.unifiSiteId })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditing(null)
    form.resetFields()
  }

  const siteMap = Object.fromEntries(sites.map((s) => [s.id, s.name]))
  const managers = allUsers.filter((u) => u.role === 'MANAGER')

  async function handleSubmit(values: { name: string; unifiSiteId: string }) {
    if (editing) {
      await updateCompany.mutateAsync({ id: editing.id, ...values })
      message.success('Empresa atualizada com sucesso')
    } else {
      await createCompany.mutateAsync(values)
      message.success('Empresa criada com sucesso')
    }
    closeForm()
  }

  async function handleDelete(company: Company) {
    await deleteCompany.mutateAsync(company.id)
    message.success('Empresa excluída')
  }

  async function handleAssign(managerId: string) {
    if (!managersCompany) return
    await assignManager.mutateAsync({ companyId: managersCompany.id, managerId })
    message.success('Gerente vinculado')
  }

  async function handleRemove(managerId: string) {
    if (!managersCompany) return
    await removeManager.mutateAsync({ companyId: managersCompany.id, managerId })
    message.success('Gerente removido')
  }

  const assignedIds = new Set(managersCompany?.managers.map((m) => m.managerId) ?? [])
  const availableManagers = managers.filter((m) => !assignedIds.has(m.id))

  const columns = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    {
      title: 'Site UniFi',
      dataIndex: 'unifiSiteId',
      key: 'unifiSiteId',
      render: (id: string) => <Tag>{siteMap[id] ?? id.slice(0, 8)}</Tag>,
    },
    {
      title: 'Planos',
      key: 'plans',
      render: (_: unknown, r: Company) => r.plans.length,
    },
    {
      title: 'Vendedores',
      key: 'sellers',
      render: (_: unknown, r: Company) => r._count.sellers,
    },
    {
      title: 'Gerentes',
      key: 'managers',
      render: (_: unknown, r: Company) =>
        r.managers.map((m) => <Tag key={m.managerId}>{m.manager.name}</Tag>),
    },
    ...(role === 'MASTER'
      ? [
          {
            title: 'Ações',
            key: 'actions',
            render: (_: unknown, r: Company) => (
              <Space wrap>
                <Button
                  size="small"
                  icon={<TeamOutlined />}
                  onClick={() => setManagersCompany(r)}
                >
                  Gerentes
                </Button>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(r)}
                >
                  Editar
                </Button>
                <Popconfirm
                  title="Excluir empresa?"
                  description="A empresa deixará de aparecer na listagem."
                  okText="Excluir"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(r)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Excluir
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Empresas</Typography.Title>
        {role === 'MASTER' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} block={isMobile}>
            Nova Empresa
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={companies}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={false}
      />

      {/* Modal: Nova / Editar Empresa */}
      <Modal
        title={editing ? 'Editar Empresa' : 'Nova Empresa'}
        open={formOpen}
        onCancel={closeForm}
        onOk={() => form.submit()}
        confirmLoading={createCompany.isPending || updateCompany.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Nome da embarcação" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unifiSiteId" label="Site UniFi" rules={[{ required: true }]}>
            <Select
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Selecione o site"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer: Gerenciar Gerentes */}
      <Drawer
        title={`Gerentes — ${managersCompany?.name}`}
        open={!!managersCompany}
        onClose={() => setManagersCompany(null)}
        width={isMobile ? '100%' : 400}
      >
        <Typography.Text type="secondary">Gerentes vinculados</Typography.Text>
        <div style={{ margin: '8px 0 20px' }}>
          {managersCompany?.managers.length === 0 && (
            <Typography.Text type="secondary">Nenhum gerente vinculado</Typography.Text>
          )}
          {managersCompany?.managers.map((m) => (
            <div key={m.managerId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{m.manager.name} <Typography.Text type="secondary">({m.manager.email})</Typography.Text></span>
              <Popconfirm title="Remover gerente?" onConfirm={() => handleRemove(m.managerId)}>
                <Button size="small" danger>Remover</Button>
              </Popconfirm>
            </div>
          ))}
        </div>

        {availableManagers.length > 0 && (
          <>
            <Typography.Text type="secondary">Adicionar gerente</Typography.Text>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              {availableManagers.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{m.name} <Typography.Text type="secondary">({m.email})</Typography.Text></span>
                  <Button size="small" type="primary" onClick={() => handleAssign(m.id)}>
                    Vincular
                  </Button>
                </div>
              ))}
            </Space>
          </>
        )}
      </Drawer>
    </>
  )
}
