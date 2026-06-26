import { Card, Form, Input, Button, Typography, Row, Col, Tag, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/authStore'
import { useUpdateProfile, useChangePassword } from '../hooks/useUsers'
import type { AxiosError } from 'axios'

const ROLE_LABEL: Record<string, string> = {
  MASTER: 'Master',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
}

function apiError(err: unknown, fallback: string) {
  const msg = (err as AxiosError<{ message?: string }>)?.response?.data?.message
  return msg ?? fallback
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const [pwdForm] = Form.useForm()

  async function handleProfile(values: { name: string; email: string }) {
    try {
      const updated = await updateProfile.mutateAsync(values)
      updateUser({ name: updated.name, email: updated.email })
      message.success('Perfil atualizado')
    } catch (err) {
      message.error(apiError(err, 'Erro ao atualizar perfil'))
    }
  }

  async function handlePassword(values: { currentPassword: string; newPassword: string }) {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success('Senha alterada com sucesso')
      pwdForm.resetFields()
    } catch (err) {
      message.error(apiError(err, 'Erro ao alterar senha'))
    }
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card
          title={
            <span>
              <UserOutlined style={{ marginRight: 8 }} />
              Dados do perfil
            </span>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Tag color="blue">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</Tag>
          </div>
          <Form
            layout="vertical"
            requiredMark={false}
            initialValues={{ name: user?.name, email: user?.email }}
            onFinish={handleProfile}
          >
            <Form.Item name="name" label="Nome" rules={[{ required: true, message: 'Informe o nome' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={updateProfile.isPending}>
              Salvar alterações
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card
          title={
            <span>
              <LockOutlined style={{ marginRight: 8 }} />
              Alterar senha
            </span>
          }
        >
          <Form form={pwdForm} layout="vertical" requiredMark={false} onFinish={handlePassword}>
            <Form.Item
              name="currentPassword"
              label="Senha atual"
              rules={[{ required: true, message: 'Informe a senha atual' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="Nova senha"
              rules={[{ required: true, min: 6, message: 'Mínimo de 6 caracteres' }]}
              hasFeedback
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirm"
              label="Confirmar nova senha"
              dependencies={['newPassword']}
              hasFeedback
              rules={[
                { required: true, message: 'Confirme a nova senha' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                    return Promise.reject(new Error('As senhas não conferem'))
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={changePassword.isPending}>
              Alterar senha
            </Button>
          </Form>
        </Card>
      </Col>

      <Col span={24}>
        <Typography.Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
          Ao alterar o e-mail, use o novo endereço no próximo login.
        </Typography.Text>
      </Col>
    </Row>
  )
}
