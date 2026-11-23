import React, { useState, useEffect } from 'react'
import { Layout, Menu, Button, Dropdown, Avatar, Typography, Tooltip, theme } from 'antd'
import {
  DashboardOutlined,
  HomeOutlined,
  AppstoreOutlined,
  TagsOutlined,
  EnvironmentOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShopOutlined,
  TeamOutlined,
  PercentageOutlined,
  CheckCircleOutlined,
  BlockOutlined,
  InboxOutlined,
  UploadOutlined,
  SwapOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  ApartmentOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Sider, Content } = Layout
const { Text } = Typography

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const getSubMenuKey = (pathname: string): string | null => {
    if (pathname.startsWith('/stock')) return 'inventory-sub'
    if (
      pathname.startsWith('/settings/attributes') ||
      pathname.startsWith('/settings/lookups') ||
      pathname.startsWith('/settings/business') ||
      pathname.startsWith('/settings/users')
    ) {
      return 'settings-sub'
    }
    return null
  }

  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const parentSub = getSubMenuKey(location.pathname)
    return parentSub ? [parentSub] : ['inventory-sub']
  })

  useEffect(() => {
    const parentSub = getSubMenuKey(location.pathname)
    if (parentSub && !openKeys.includes(parentSub)) {
      setOpenKeys((prev) => [...prev, parentSub])
    }
  }, [location.pathname])

  const userMenuItems = [
    {
      key: 'profile',
      label: 'Business Profile',
      icon: <ShopOutlined />,
      onClick: () => navigate('/settings/business'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: 'Sign Out',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: async () => {
        await logout()
        navigate('/login')
      },
    },
  ]

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/home-search',
      icon: <HomeOutlined />,
      label: 'Home & Search',
    },
    {
      key: '/products',
      icon: <AppstoreOutlined />,
      label: 'Products',
    },
    {
      key: '/supplier-orders',
      icon: <ShoppingCartOutlined />,
      label: 'Supplier Orders (Crystal)',
    },
    {
      key: 'inventory-sub',
      icon: <InboxOutlined />,
      label: 'Inventory & Stock',
      children: [
        {
          key: '/stock/maintenance',
          icon: <ApartmentOutlined />,
          label: 'Stock Maintenance',
        },
        {
          key: '/stock/transfers',
          icon: <SwapOutlined />,
          label: 'Stock Transfers',
        },
        {
          key: '/stock/movements',
          icon: <HistoryOutlined />,
          label: 'Movement Ledger',
        },
        {
          key: '/stock/ageing',
          icon: <ClockCircleOutlined />,
          label: 'Ageing & Valuation',
        },
      ],
    },
    {
      key: '/products/import',
      icon: <UploadOutlined />,
      label: 'CSV Import',
    },
    {
      key: '/settings/categories',
      icon: <BlockOutlined />,
      label: 'Categories',
    },
    {
      key: '/settings/brands',
      icon: <TagsOutlined />,
      label: 'Brands',
    },
    {
      key: '/locations',
      icon: <EnvironmentOutlined />,
      label: 'Locations',
    },
    {
      key: 'settings-sub',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        {
          key: '/settings/attributes',
          icon: <ApartmentOutlined />,
          label: 'Category Specifications',
        },
        {
          key: '/settings/lookups',
          icon: <DatabaseOutlined />,
          label: 'Lookup Master',
        },
        {
          key: '/settings/business',
          icon: <ShopOutlined />,
          label: 'Business Profile',
        },
        {
          key: '/settings/users',
          icon: <TeamOutlined />,
          label: 'User Management',
        },
      ],
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        width={240}
        collapsedWidth={72}
        style={{
          borderRight: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}
        >
          {/* Sider Header: Logo + Collapse/Expand Toggle */}
          <div
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              padding: collapsed ? '0 8px' : '0 12px 0 16px',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
            }}
          >
            {!collapsed ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                  onClick={() => navigate('/')}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '15px',
                      flexShrink: 0,
                    }}
                  >
                    SP
                  </div>
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    <Text strong style={{ fontSize: '15px', display: 'block', lineHeight: 1.2 }}>
                      StockPilot
                    </Text>
                    <Text type="secondary" style={{ fontSize: '10.5px', display: 'block' }}>
                      {currentUser?.business?.name || 'Retail ERP'}
                    </Text>
                  </div>
                </div>
                <Tooltip title="Collapse sidebar" placement="right">
                  <Button
                    type="text"
                    icon={<MenuFoldOutlined />}
                    onClick={() => setCollapsed(true)}
                    style={{ fontSize: '16px', width: 32, height: 32, color: '#64748b' }}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip title="Expand sidebar" placement="right">
                <Button
                  type="text"
                  icon={<MenuUnfoldOutlined />}
                  onClick={() => setCollapsed(false)}
                  style={{ fontSize: '18px', width: 36, height: 36, color: '#1677ff' }}
                />
              </Tooltip>
            )}
          </div>

          {/* Sider Menu (Scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <Menu
              mode="inline"
              selectedKeys={[
                location.pathname === '/stock/mapping' || location.pathname === '/stock/balances'
                  ? '/stock/maintenance'
                  : location.pathname === '/dashboard'
                  ? '/'
                  : location.pathname,
              ]}
              openKeys={collapsed ? undefined : openKeys}
              onOpenChange={(keys) => setOpenKeys(keys)}
              items={menuItems}
              onClick={({ key }) => {
                if (key.startsWith('/')) navigate(key)
              }}
              style={{ borderRight: 0, paddingTop: '8px' }}
            />
          </div>

          {/* Sider Bottom: User Profile Avatar & Dropdown */}
          <div
            style={{
              padding: collapsed ? '12px 0' : '10px 14px',
              borderTop: '1px solid #f1f5f9',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              flexShrink: 0,
            }}
          >
            <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  width: '100%',
                  padding: collapsed ? '0' : '4px',
                  borderRadius: '6px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <Avatar
                  style={{
                    backgroundColor: '#1677ff',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(22, 119, 255, 0.25)',
                  }}
                  size={34}
                >
                  {currentUser?.user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                {!collapsed && (
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.25, flex: 1 }}>
                    <Text
                      strong
                      style={{ fontSize: '13px', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}
                    >
                      {currentUser?.user?.full_name || 'User'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                      {currentUser?.role?.name || 'Staff'} • {currentUser?.business?.name || 'HomeDecor'}
                    </Text>
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </div>
      </Sider>

      <Layout style={{ background: '#f8fafc', minHeight: '100vh' }}>
        <Content
          style={{
            padding: '16px 24px',
            background: '#f8fafc',
            minHeight: '100vh',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
