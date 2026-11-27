import React from 'react'
import { Card, Spin, Typography, Tag, Empty, Button } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dashboardApi from '../../api/dashboard'
import { formatIndianCurrency, formatIndianNumber } from '../../utils/currency'

const { Title, Text } = Typography

export const MobileDashboardPage: React.FC = () => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mobile-dashboard-summary'],
    queryFn: () => dashboardApi.getSummary(),
  })

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  const inv = data?.inventory
  const health = data?.stock_health
  const action = data?.action_required
  const recent = data?.recent_activity || []

  const kpis = [
    { label: 'Total Products', value: formatIndianNumber(inv?.total_products ?? 0), color: '#1677ff', bg: '#eff6ff' },
    { label: 'Available Stock', value: formatIndianNumber(inv?.available_stock ?? 0), color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Low Stock', value: formatIndianNumber(health?.low_stock_products ?? 0), color: '#d97706', bg: '#fffbeb' },
    { label: 'Out of Stock', value: formatIndianNumber(health?.out_of_stock_products ?? 0), color: '#dc2626', bg: '#fef2f2' },
    { label: 'Pending Transfers', value: formatIndianNumber(action?.pending_transfers ?? 0), color: '#0891b2', bg: '#ecfeff' },
    { label: 'Damaged Units', value: formatIndianNumber(health?.damaged_stock ?? 0), color: '#64748b', bg: '#f8fafc' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          Dashboard
        </Title>
        <Button
          size="small"
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={() => refetch()}
        >
          Refresh
        </Button>
      </div>

      {inv?.can_view_valuation && inv.inventory_valuation != null && (
        <Card
          style={{
            borderRadius: 14,
            marginBottom: 12,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: 'none',
          }}
          bodyStyle={{ padding: '14px 16px' }}
        >
          <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block' }}>
            Inventory Valuation
          </Text>
          <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 700 }}>
            {formatIndianCurrency(inv.inventory_valuation)}
          </div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.label}
            style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: '12px 14px',
              border: '1px solid #e2e8f0',
            }}
          >
            <Text style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
              {k.label}
            </Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <Title level={5} style={{ marginBottom: 8, fontWeight: 700 }}>
        Recent Stock Activity
      </Title>
      {recent.length === 0 ? (
        <Card style={{ borderRadius: 12 }}>
          <Empty description="No recent activity" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.slice(0, 10).map((item) => (
            <Card key={item.id} size="small" style={{ borderRadius: 10 }} bodyStyle={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>
                    {item.product_name}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11.5 }}>
                    {item.sku} · {item.location_name}
                  </Text>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <Tag color={Number(item.quantity) >= 0 ? 'green' : 'volcano'} style={{ margin: 0 }}>
                    {item.activity || item.movement_type} ({item.quantity})
                  </Tag>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
