import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Alert, Button, Tag, Card, message } from 'antd'
import {
  BarChartOutlined,
  SearchOutlined,
  TagsOutlined,
  InboxOutlined,
  SwapOutlined,
  ShoppingCartOutlined,
  DownloadOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { useAuth } from '../../auth/AuthContext'

const { Title, Text } = Typography

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface TileConfig {
  id: string
  title: string
  hint: string
  path: string
  icon: React.ReactNode
  bg: string
  color: string
}

const MOBILE_TILE_CARDS: TileConfig[] = [
  {
    id: 'search',
    title: 'Product Search',
    hint: 'Price & multi-location stock',
    path: '/mobile/search',
    icon: <SearchOutlined />,
    bg: '#eff6ff',
    color: '#1677ff',
  },
  {
    id: 'products',
    title: 'Products',
    hint: 'Browse catalogue & details',
    path: '/mobile/products',
    icon: <TagsOutlined />,
    bg: '#f0fdf4',
    color: '#16a34a',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    hint: 'KPIs & low stock alerts',
    path: '/mobile/dashboard',
    icon: <BarChartOutlined />,
    bg: '#faf5ff',
    color: '#9333ea',
  },
  {
    id: 'stock_maintenance',
    title: 'Stock Maintenance',
    hint: 'Stock In / Out / Adjust',
    path: '/mobile/stock-maintenance',
    icon: <InboxOutlined />,
    bg: '#fff7ed',
    color: '#ea580c',
  },
  {
    id: 'stock_transfers',
    title: 'Stock Transfers',
    hint: 'Move between locations',
    path: '/mobile/stock-transfers',
    icon: <SwapOutlined />,
    bg: '#ecfeff',
    color: '#0891b2',
  },
  {
    id: 'supplier_orders',
    title: 'Supplier Orders',
    hint: 'View & receive POs',
    path: '/mobile/supplier-orders',
    icon: <ShoppingCartOutlined />,
    bg: '#fef2f2',
    color: '#dc2626',
  },
]

export const MobileHomePage: React.FC = () => {
  const { mobilePages, currentUser } = useAuth()
  const navigate = useNavigate()

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('unsupported')

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isHttpsOrLocal =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsInstalled(standalone)

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    if ('Notification' in window && isHttpsOrLocal) {
      setNotifPerm(Notification.permission)
    } else {
      setNotifPerm('unsupported')
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [isHttpsOrLocal])

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
        setInstallPrompt(null)
      }
      return
    }
    if (isIos) {
      message.info('Tap Share (⬆️) in Safari, then choose "Add to Home Screen".')
    } else {
      message.info('Open your browser menu (⋮) and tap "Install app" or "Add to Home screen".')
    }
  }

  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !isHttpsOrLocal) {
      message.warning('Notifications require HTTPS and a supported mobile browser.')
      return
    }
    try {
      const perm = await Notification.requestPermission()
      setNotifPerm(perm)
      if (perm === 'granted') {
        message.success('Notifications enabled!')
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready
          reg.showNotification('StockPilot Mobile', {
            body: 'Notifications are now enabled for your account.',
            icon: '/icons/icon-192.png',
          })
        }
      } else if (perm === 'denied') {
        message.error('Notifications blocked. Enable them in your browser site settings.')
      }
    } catch {
      message.error('Could not enable notifications on this browser.')
    }
  }

  const visibleTiles = MOBILE_TILE_CARDS.filter((tile) => Boolean(mobilePages[tile.id]))

  const notifStatusBadge = () => {
    if (notifPerm === 'unsupported') return <Tag style={{ margin: 0 }}>N/A</Tag>
    if (notifPerm === 'granted') return <Tag color="success" style={{ margin: 0 }}>On</Tag>
    if (notifPerm === 'denied') return <Tag color="error" style={{ margin: 0 }}>Blocked</Tag>
    return <Tag color="default" style={{ margin: 0 }}>Off</Tag>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
          Welcome, {currentUser?.user?.full_name?.split(' ')[0] || 'Team'}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Choose a workspace tool below
        </Text>
      </div>

      {visibleTiles.length === 0 ? (
        <Alert
          type="warning"
          showIcon
          message="No Mobile Tiles Enabled"
          description="Your administrator hasn't enabled any mobile tiles for your account yet. Ask your admin to enable tiles in Settings → Users."
          style={{ borderRadius: 12 }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          {visibleTiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => navigate(tile.path)}
              style={{
                textAlign: 'left',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: 16,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: tile.bg,
                  color: tile.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                {tile.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 2 }}>
                  {tile.title}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.3 }}>
                  {tile.hint}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Install StockPilot App Card */}
      {!isInstalled && (
        <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <img
              src="/icons/icon-192.png"
              alt="StockPilot"
              style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                Install StockPilot app
              </div>
              <Text type="secondary" style={{ fontSize: 12.5, lineHeight: 1.35, display: 'block' }}>
                Add the StockPilot icon to your home screen for quick access.
              </Text>
            </div>
          </div>
          <Button
            type="primary"
            block
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleInstallClick}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Install app
          </Button>
        </Card>
      )}

      {/* Notifications Card */}
      <Card style={{ borderRadius: 14, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              <BellOutlined style={{ marginRight: 6 }} />
              Notifications
            </div>
            <Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginTop: 2 }}>
              {notifPerm === 'unsupported'
                ? 'Notifications need HTTPS and a supported mobile browser.'
                : notifPerm === 'granted'
                  ? 'Alerts are enabled for this device.'
                  : notifPerm === 'denied'
                    ? 'Notifications are blocked in browser settings.'
                    : 'Enable alerts for stock updates and transfers.'}
            </Text>
          </div>
          {notifStatusBadge()}
        </div>
        {notifPerm === 'default' && (
          <Button
            type="primary"
            block
            size="large"
            onClick={handleEnableNotifications}
            style={{ borderRadius: 10, fontWeight: 600, marginTop: 6 }}
          >
            Enable notifications
          </Button>
        )}
      </Card>
    </div>
  )
}
