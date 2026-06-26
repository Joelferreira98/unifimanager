import { useEffect, useState } from 'react'
import { Modal, Table, Select, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  useImportableVouchers,
  useImportVouchers,
  type ImportableVoucher,
} from '../hooks/useVouchers'
import { usePlans } from '../hooks/usePlans'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string | null
}

export default function ImportVouchersModal({ open, onClose, companyId }: Props) {
  const { data: importable = [], isLoading } = useImportableVouchers(companyId, open)
  const { data: plans = [] } = usePlans(companyId)
  const importMut = useImportVouchers()

  // unifiVoucherId -> planId escolhido
  const [assign, setAssign] = useState<Record<string, string | undefined>>({})

  // Limpa as escolhas quando o modal fecha
  useEffect(() => {
    if (!open) setAssign({})
  }, [open])

  // Pré-preenche com a sugestão do backend, sem sobrescrever escolhas do usuário
  useEffect(() => {
    setAssign((prev) => {
      const next = { ...prev }
      for (const v of importable) {
        if (!(v.unifiVoucherId in next)) next[v.unifiVoucherId] = v.suggestedPlanId ?? undefined
      }
      return next
    })
  }, [importable])

  const planOptions = plans.map((p) => ({
    value: p.id,
    label: `${p.name} — R$ ${Number(p.price).toFixed(2)}`,
  }))

  const selectedCount = Object.values(assign).filter(Boolean).length

  async function handleImport() {
    if (!companyId) return
    const items = Object.entries(assign)
      .filter(([, planId]) => !!planId)
      .map(([unifiVoucherId, planId]) => ({ unifiVoucherId, planId: planId as string }))

    if (items.length === 0) {
      message.warning('Selecione o plano de ao menos um voucher')
      return
    }
    try {
      const res = await importMut.mutateAsync({ companyId, items })
      message.success(`${res.imported} voucher(s) importado(s)`)
      onClose()
    } catch {
      message.error('Erro ao importar vouchers')
    }
  }

  const columns: ColumnsType<ImportableVoucher> = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Nome (UniFi)',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => n || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Tempo',
      dataIndex: 'timeLimitMinutes',
      key: 'time',
      render: (m: number) => `${m} min`,
    },
    {
      title: 'Situação',
      key: 'state',
      render: (_, r) =>
        r.used ? (
          <Tag color="green">Vendido{r.expired ? ' (expirado)' : ''}</Tag>
        ) : r.expired ? (
          <Tag color="default">Expirado</Tag>
        ) : (
          <Tag color="orange">Disponível</Tag>
        ),
    },
    {
      title: 'Plano',
      key: 'plan',
      render: (_, r) => (
        <Select
          style={{ width: 230 }}
          placeholder="Escolha o plano"
          value={assign[r.unifiVoucherId]}
          onChange={(v) => setAssign((s) => ({ ...s, [r.unifiVoucherId]: v }))}
          options={planOptions}
          status={assign[r.unifiVoucherId] ? undefined : 'warning'}
          allowClear
        />
      ),
    },
  ]

  return (
    <Modal
      title="Importar vouchers da controladora"
      open={open}
      onCancel={onClose}
      onOk={handleImport}
      okText={selectedCount > 0 ? `Importar ${selectedCount}` : 'Importar'}
      okButtonProps={{ disabled: selectedCount === 0 }}
      confirmLoading={importMut.isPending}
      width={820}
    >
      <Typography.Paragraph type="secondary">
        Vouchers que existem na controladora UniFi e ainda não estão no sistema. Quando o nome
        bate com um plano, ele já vem selecionado; escolha o plano dos demais. Vouchers sem plano
        selecionado não são importados.
      </Typography.Paragraph>
      <Table
        rowKey="unifiVoucherId"
        size="small"
        loading={isLoading}
        dataSource={importable}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={false}
        locale={{ emptyText: 'Nenhum voucher para importar' }}
      />
    </Modal>
  )
}
