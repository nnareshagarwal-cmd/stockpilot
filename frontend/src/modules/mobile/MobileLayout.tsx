import React from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Spin, Typography } from 'antd'
import { ArrowLeftOutlined, LogoutOutlined, HomeOutlined } from '@ant-design/icons'
import { useAuth } from '../../auth/AuthContext'

const { Text } = Typography

export const MobileLayout: React.FC = () => {
  const { isAuthenticated, isLoading, currentUser, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/mobile/login" state={{ from: location }} replace />
  }

  const isHome = location.pathname === '/mobile' || location.pathname === '/mobile/'

  const handleLogout = async () => {
    await logout()
    navigate('/mobile/login', { replace: true })
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 640,
        margin: '0 auto',
        boxShadow: '0 0 24px rgba(15, 23, 42, 0.06)',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#0f172a',
          color: '#ffffff',
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {!isHome ? (
            <Button
              type="text"
              icon={<ArrowLeftOutlined style={{ color: '#fff', fontSize: 16 }} />}
              onClick={() => navigate(-1)}
              style={{ padding: '4px 6px', height: 34 }}
              aria-label="Back"
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #1677ff 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              SP
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.business?.name || 'StockPilot'}
            </div>
            <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block', lineHeight: 1.2 }}>
              {currentUser?.user?.full_name}
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!isHome && (
            <Button
              type="text"
              icon={<HomeOutlined style={{ color: '#e2e8f0', fontSize: 16 }} />}
              onClick={() => navigate('/mobile')}
              style={{ padding: '4px 8px', height: 34 }}
              aria-label="Home"
            />
          )}
          <Button
            type="text"
            icon={<LogoutOutlined style={{ color: '#fca5a5', fontSize: 16 }} />}
            onClick={handleLogout}
            style={{ padding: '4px 8px', height: 34, color: '#fca5a5', fontSize: 12 }}
          >
            Logout
          </Button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          padding: '14px 14px calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}
