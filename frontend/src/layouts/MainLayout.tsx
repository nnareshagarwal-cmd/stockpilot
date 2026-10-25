import React, { useState } from 'react'
import { Layout, Menu, Button, Dropdown, Avatar, Space, Typography, Input, theme } from 'antd'
import {
  HomeOutlined,
  AppstoreOutlined,
  TagsOutlined,
  EnvironmentOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SearchOutlined,
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
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()

  const handleGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

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
      icon: <HomeOutlined />,
      label: 'Home & Search',
    },
    {
      key: '/products',
      icon: <AppstoreOutlined />,
      label: 'Products',
    },
    {
      key: 'inventory-sub',
      icon: <InboxOutlined />,
      label: 'Inventory & Stock',
      children: [
        {
          key: '/stock/mapping',
          icon: <ApartmentOutlined />,
          label: 'Stock Mapping',
        },
        {
          key: '/stock/balances',
          icon: <AppstoreOutlined />,
          label: 'Stock Balances',
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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        width={240}
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
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 20px' : '0 24px',
            gap: '12px',
            borderBottom: '1px solid #f1f5f9',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            SP
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <Text strong style={{ fontSize: '16px', display: 'block', lineHeight: 1.2 }}>
                StockPilot
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                {currentUser?.business?.name || 'Retail ERP'}
              </Text>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => {
            if (key !== 'settings-sub') navigate(key)
          }}
          style={{ borderRight: 0, paddingTop: '12px' }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            position: 'sticky',
            top: 0,
            zIndex: 9,
            height: '64px',
          }}
        >
          <Space size={16}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 40, height: 40 }}
            />
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search products, SKUs, specifications (e.g. 18W, Sofa)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleGlobalSearch}
              style={{ width: '360px', borderRadius: '8px', background: '#f8fafc' }}
              allowClear
            />
          </Space>

          <Space direction="horizontal" size={16}>
            <div style={{ textAlign: 'right', display: 'none', md: 'block' } as any}>
              <Text strong style={{ display: 'block', fontSize: '13px' }}>
                {currentUser?.user?.full_name}
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                {currentUser?.role?.name || 'Staff'} • {currentUser?.business?.name}
              </Text>
            </div>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Avatar
                style={{
                  backgroundColor: '#1677ff',
                  cursor: 'pointer',
                  verticalAlign: 'middle',
                  boxShadow: '0 2px 8px rgba(22, 119, 255, 0.25)',
                }}
                size={38}
              >
                {currentUser?.user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            padding: '24px',
            background: '#f8fafc',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
