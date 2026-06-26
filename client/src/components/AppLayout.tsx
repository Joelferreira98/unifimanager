import { useEffect, useState } from 'react'
import { Layout, Menu, Button, Select, Typography, Grid, Drawer } from 'antd'
import {
  DashboardOutlined,
  WifiOutlined,
  FileTextOutlined,
  ShopOutlined,
  TeamOutlined,
  DollarOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  IdcardOutlined,
  BarChartOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCompanyStore } from '../store/companyStore'
import { useSettingsStore } from '../store/settingsStore'
import { useCompanies } from '../hooks/useCompanies'

const { Sider, Content, Header } = Layout
const { useBreakpoint } = Grid

const allMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard', roles: ['MASTER', 'MANAGER', 'SELLER'] },
  { key: '/vouchers', icon: <WifiOutlined />, label: 'Vouchers', roles: ['MASTER', 'MANAGER', 'SELLER'] },
  { key: '/plans', icon: <FileTextOutlined />, label: 'Planos', roles: ['MASTER', 'MANAGER'] },
  { key: '/companies', icon: <ShopOutlined />, label: 'Empresas', roles: ['MASTER', 'MANAGER'] },
  { key: '/users', icon: <TeamOutlined />, label: 'Usuários', roles: ['MASTER', 'MANAGER'] },
  { key: '/cash-register', icon: <DollarOutlined />, label: 'Caixa', roles: ['MASTER', 'MANAGER', 'SELLER'] },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Relatórios', roles: ['MASTER', 'MANAGER'] },
  { key: '/global-reports', icon: <GlobalOutlined />, label: 'Relatório Geral', roles: ['MASTER'] },
  { key: '/voucher-template', icon: <IdcardOutlined />, label: 'Personalizar Voucher', roles: ['MASTER', 'MANAGER'] },
  { key: '/settings', icon: <SettingOutlined />, label: 'Configurações', roles: ['MASTER'] },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()
  const settings = useSettingsStore((s) => s.settings)
  const { data: companies = [] } = useCompanies()

  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [drawerOpen, setDrawerOpen] = useState(false)

  // SELLER: sempre usa a própria empresa
  useEffect(() => {
    if (user?.role === 'SELLER' && user.companyId) {
      setSelectedCompanyId(user.companyId)
    }
  }, [user, setSelectedCompanyId])

  // Auto-seleciona a primeira empresa se nenhuma estiver selecionada
  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0 && user?.role !== 'SELLER') {
      setSelectedCompanyId(companies[0].id)
    }
  }, [companies, selectedCompanyId, user, setSelectedCompanyId])

  function handleLogout() {
    logout()
    setSelectedCompanyId(null)
    navigate('/login')
  }

  function go(key: string) {
    navigate(key)
    setDrawerOpen(false)
  }

  const menuItems = allMenuItems
    .filter((item) => {
      // Relatório geral: MASTER, ou usuário a quem o master concedeu permissão.
      if (item.key === '/global-reports') return user?.role === 'MASTER' || !!user?.canViewGlobalReports
      return item.roles.includes(user?.role ?? '')
    })
    .map(({ key, icon, label }) => ({ key, icon, label }))

  const selectedCompanyName = companies.find((c) => c.id === selectedCompanyId)?.name
  const pageTitle =
    allMenuItems.find((i) => i.key === location.pathname)?.label ??
    (location.pathname === '/profile' ? 'Perfil' : settings.appName)

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {settings.logoUrl ? (
          <img src={settings.logoUrl} alt="logo" style={{ width: 34, height: 34, borderRadius: 10, objectFit: 'contain', flexShrink: 0 }} />
        ) : (
          <div className="brand-box" style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WifiOutlined style={{ color: '#fff', fontSize: 17 }} />
          </div>
        )}
        <Typography.Text strong className="brand-gradient" style={{ fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {settings.appName}
        </Typography.Text>
      </div>

      {/* Seletor de empresa */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 5, letterSpacing: '0.5px' }}>EMPRESA</div>
        {user?.role === 'SELLER' ? (
          <Typography.Text style={{ color: '#fff', fontSize: 13 }}>{selectedCompanyName ?? '—'}</Typography.Text>
        ) : (
          <Select
            style={{ width: '100%' }}
            size="small"
            placeholder="Selecionar empresa"
            value={selectedCompanyId}
            onChange={setSelectedCompanyId}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            loading={companies.length === 0}
          />
        )}
      </div>

      {/* Menu de navegação */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => go(key)}
        style={{ borderRight: 0, marginTop: 4 }}
      />

      {/* Usuário + logout na base */}
      <div style={{
        marginTop: 'auto',
        padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div
          onClick={() => go('/profile')}
          title="Editar perfil"
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}
        >
          <div className="brand-box" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
              {user?.role === 'MASTER' ? 'Master' : user?.role === 'MANAGER' ? 'Gerente' : 'Vendedor'}
            </div>
          </div>
        </div>
        <Button type="text" icon={<LogoutOutlined style={{ color: 'rgba(255,255,255,0.65)' }} />} onClick={handleLogout} title="Sair" />
      </div>
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={250}
          closable={false}
          styles={{ body: { padding: 0 } }}
          className="app-menu-drawer"
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Sider width={220}>{sidebarContent}</Sider>
      )}

      <Layout>
        <Header style={{
          background: 'transparent', padding: isMobile ? '0 14px' : '0 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            <Typography.Title level={4} style={{ margin: 0, color: '#fff', fontSize: isMobile ? 16 : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pageTitle}
            </Typography.Title>
          </div>
          {!isMobile && (
            <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, whiteSpace: 'nowrap' }}>
              {selectedCompanyName ? selectedCompanyName : 'Nenhuma empresa selecionada'}
            </Typography.Text>
          )}
        </Header>
        <Content style={{ margin: isMobile ? 12 : 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
