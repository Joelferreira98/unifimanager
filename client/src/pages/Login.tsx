import { Form, Input, Button, Card, Typography, message } from 'antd'
import { WifiOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const settings = useSettingsStore((s) => s.settings)

  async function onFinish(values: { email: string; password: string }) {
    try {
      const { data } = await api.post('/auth/login', values)
      setAuth(data.token, data.user)
      navigate('/dashboard')
    } catch {
      message.error('E-mail ou senha inválidos')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 380 }} styles={{ body: { padding: 32 } }}>
        {/* Marca */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt="logo"
              style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'contain', margin: '0 auto 16px', display: 'block' }}
            />
          ) : (
            <div
              className="brand-box"
              style={{
                width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <WifiOutlined style={{ color: '#fff', fontSize: 28 }} />
            </div>
          )}
          <Typography.Title level={3} className="brand-gradient" style={{ margin: 0 }}>
            {settings.appName}
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.55)' }}>
            Entre para gerenciar seus vouchers
          </Typography.Text>
        </div>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="seu@email.com" />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block style={{ marginTop: 8, height: 44 }}>
            Entrar
          </Button>
        </Form>
      </Card>
    </div>
  )
}
