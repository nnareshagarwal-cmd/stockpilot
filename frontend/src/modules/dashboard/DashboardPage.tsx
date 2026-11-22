import React, { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Tag,
  Spin,
  Alert,
  Table,
  Empty,
  Tooltip,
} from 'antd'
import {
  AppstoreOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  DollarCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  ShopOutlined,
  SwapOutlined,
  CheckCircleFilled,
  HistoryOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dashboardApi, {
  DashboardSummary,
  AgeingBand,
  RecentStockActivity,
} from '../../api/dashboard'

const { Title, Text, Paragraph } = Typography

// Distinct colors for the 5 FIFO ageing categories
const AGEING_BAND_COLORS: Record<string, string> = {
  Fresh: '#10b981', // 0-30 days (Emerald)
  Moderate: '#06b6d4', // 31-60 days (Cyan)
  Ageing: '#f59e0b', // 61-90 days (Amber)
  Old: '#f97316', // 91-180 days (Orange)
  'Very Old': '#ef4444', // 180+ days (Red)
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await dashboardApi.getSummary()
      setData(res)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'Failed to load inventory dashboard metrics. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Currency & number formatting in Indian numbering system
  const formatIndianNumber = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null) return '0'
    const num = Number(val)
    if (isNaN(num)) return '0'
    return num.toLocaleString('en-IN')
  }

  const formatCurrencyINR = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null) return '₹0'
    const num = Number(val)
    if (isNaN(num)) return '₹0'
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num)
  }

  const formatDateTime = (dateStr: string): string => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const getActivityTag = (activity: string, movementType: string) => {
    const act = (activity || '').toLowerCase()
    const mt = (movementType || '').toUpperCase()

    if (act.includes('opening') || mt === 'OPENING_STOCK') {
      return <Tag color="cyan">Opening Stock</Tag>
    }
    if (act.includes('condition') || mt === 'CONDITION_CHANGE') {
      return <Tag color="purple">Condition Change</Tag>
    }
    if (act.includes('transfer') || mt.startsWith('TRANSFER')) {
      return <Tag color="blue">{activity}</Tag>
    }
    if (act.includes('adjust') || mt.includes('ADJUST') || mt === 'STOCK_MAPPING') {
      return <Tag color="orange">Adjustment</Tag>
    }
    if (act.includes('received') || mt.includes('IN') || mt.includes('RECEIPT')) {
      return <Tag color="green">Stock Received</Tag>
    }
    if (act.includes('issued') || mt.includes('OUT') || mt.includes('ISSUE')) {
      return <Tag color="default">Stock Issued</Tag>
    }
    return <Tag color="blue">{activity || movementType}</Tag>
  }

  if (loading && !data) {
    return (
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '64px 0', textAlign: 'center' }}>
        <Spin size="large" tip="Loading inventory position and stock health..." />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 0' }}>
        <Alert
          type="error"
          showIcon
          message="Unable to Load Dashboard"
          description={error}
          action={
            <Button size="small" danger onClick={fetchDashboardData}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  const inv = data?.inventory
  const health = data?.stock_health
  const ageing = data?.ageing
  const act = data?.action_required
  const recentActivity = data?.recent_activity || []

  // Table columns for Recent Stock Activity
  const activityColumns = [
    {
      title: 'Date & Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (val: string) => (
        <Text style={{ fontSize: '13px', color: '#475569' }}>
          {formatDateTime(val)}
        </Text>
      ),
    },
    {
      title: 'Product & SKU',
      key: 'product',
      render: (_: any, record: RecentStockActivity) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
            {record.product_name}
          </div>
          <Space size={6} style={{ marginTop: '2px' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                background: '#f1f5f9',
                padding: '1px 6px',
                borderRadius: '4px',
                color: '#334155',
              }}
            >
              {record.sku}
            </span>
            {record.variant_name && record.variant_name !== record.product_name && (
              <Text type="secondary" style={{ fontSize: '11.5px' }}>
                ({record.variant_name})
              </Text>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: 'Activity',
      key: 'activity',
      width: 160,
      render: (_: any, record: RecentStockActivity) =>
        getActivityTag(record.activity, record.movement_type),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'right' as const,
      render: (val: number | string) => {
        const num = Number(val)
        const isPositive = num > 0
        const isNegative = num < 0
        return (
          <span
            style={{
              fontWeight: 700,
              fontSize: '13.5px',
              color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#475569',
            }}
          >
            {isPositive ? `+${formatIndianNumber(num)}` : formatIndianNumber(num)}
          </span>
        )
      },
    },
    {
      title: 'Location',
      dataIndex: 'location_name',
      key: 'location_name',
      width: 180,
      render: (val: string) => (
        <Space size={4}>
          <ShopOutlined style={{ color: '#64748b', fontSize: '12px' }} />
          <Text style={{ fontSize: '13px', color: '#334155' }}>{val}</Text>
        </Space>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'reference_number',
      key: 'reference_number',
      width: 150,
      render: (val?: string | null) =>
        val ? (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#2563eb',
              background: '#eff6ff',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {val}
          </span>
        ) : (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            —
          </Text>
        ),
    },
  ]

  // Check if any action is genuinely required
  const hasActions =
    (act?.replenishment_products || 0) > 0 ||
    (act?.out_of_stock_products || 0) > 0 ||
    (act?.pending_transfers || 0) > 0 ||
    !act?.reconciliation_balanced

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Top Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
            Inventory Overview
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitor your inventory position and stock health.
          </Paragraph>
        </div>

        <Space size={12} align="center">
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={fetchDashboardData}
            loading={loading}
            size="middle"
            style={{ borderRadius: '6px' }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="warning"
          showIcon
          closable
          message="Sync Warning"
          description={error}
          style={{ marginBottom: '20px' }}
        />
      )}

      {/* PART 1: Primary KPI Cards (Single row of 4 cards on desktop) */}
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          {/* Card 1: Total Products */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/products?clear=true')}
              style={{
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '100%',
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text type="secondary" style={{ fontSize: '12.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Products
                </Text>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}
                >
                  <AppstoreOutlined />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                {formatIndianNumber(inv?.total_products)}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Active catalog items
                </Text>
                <ArrowRightOutlined style={{ fontSize: '11px', color: '#94a3b8' }} />
              </div>
            </Card>
          </Col>

          {/* Card 2: Total Stock */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/stock/maintenance?tab=all')}
              style={{
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '100%',
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text type="secondary" style={{ fontSize: '12.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Stock
                </Text>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}
                >
                  <InboxOutlined />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                {formatIndianNumber(inv?.total_stock)}{' '}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>units</span>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Physical quantity on hand
                </Text>
                <ArrowRightOutlined style={{ fontSize: '11px', color: '#94a3b8' }} />
              </div>
            </Card>
          </Col>

          {/* Card 3: Available Stock */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/stock/maintenance?tab=all&status=sellable')}
              style={{
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '100%',
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text type="secondary" style={{ fontSize: '12.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Available Stock
                </Text>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#f0fdfa',
                    color: '#0d9488',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}
                >
                  <CheckCircleOutlined />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '28px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                {formatIndianNumber(inv?.available_stock)}{' '}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>units</span>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {Number(inv?.reserved_stock || 0) > 0
                    ? `Deducted ${formatIndianNumber(inv?.reserved_stock)} reserved`
                    : 'Ready for fulfillment'}
                </Text>
                <ArrowRightOutlined style={{ fontSize: '11px', color: '#94a3b8' }} />
              </div>
            </Card>
          </Col>

          {/* Card 4: Inventory Valuation */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => inv?.can_view_valuation && navigate('/stock/ageing')}
              style={{
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '100%',
                cursor: inv?.can_view_valuation ? 'pointer' : 'default',
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text type="secondary" style={{ fontSize: '12.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Inventory Valuation
                </Text>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: '#faf5ff',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}
                >
                  <DollarCircleOutlined />
                </div>
              </div>

              {inv?.can_view_valuation ? (
                <>
                  <div style={{ marginTop: '12px', fontSize: '26px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                    {formatCurrencyINR(inv.inventory_valuation)}
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Tag color="purple" style={{ margin: 0, fontSize: '11px', borderRadius: '4px' }}>
                      {inv.valuation_basis}
                    </Tag>
                    <ArrowRightOutlined style={{ fontSize: '11px', color: '#94a3b8' }} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                    <LockOutlined style={{ fontSize: '16px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Restricted</span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Financial cost valuation restricted
                    </Text>
                  </div>
                </>
              )}
            </Card>
          </Col>
        </Row>
      </div>

      {/* PART 2: Compact Stock Health Section */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginBottom: '24px',
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
              Stock Health
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Real-time threshold status and condition distribution
            </Text>
          </div>
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/stock/maintenance?tab=all')}
            style={{ padding: 0, fontSize: '13px', fontWeight: 600 }}
          >
            Manage Stock Maintenance →
          </Button>
        </div>

        <Row gutter={[16, 16]}>
          {/* Health Item 1: Low Stock Products (Amber) */}
          <Col xs={24} sm={12} lg={6}>
            <div
              onClick={() => navigate('/products?stock_status=low_stock')}
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderLeft: '4px solid #f59e0b',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>
                  Low Stock Products
                </span>
                <WarningOutlined style={{ color: '#d97706', fontSize: '16px' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309', marginTop: '6px' }}>
                {formatIndianNumber(health?.low_stock_products)}
              </div>
              <div style={{ fontSize: '11.5px', color: '#78350f', marginTop: '4px' }}>
                {Number(health?.low_stock_products || 0) === 0
                  ? 'All items above reorder points'
                  : 'Variants below reorder threshold'}
              </div>
            </div>
          </Col>

          {/* Health Item 2: Out of Stock Products (Red) */}
          <Col xs={24} sm={12} lg={6}>
            <div
              onClick={() => navigate('/products?stock_status=out_of_stock')}
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderLeft: '4px solid #ef4444',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b' }}>
                  Out of Stock Products
                </span>
                <CloseCircleOutlined style={{ color: '#dc2626', fontSize: '16px' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#b91c1c', marginTop: '6px' }}>
                {formatIndianNumber(health?.out_of_stock_products)}
              </div>
              <div style={{ fontSize: '11.5px', color: '#7f1d1d', marginTop: '4px' }}>
                Catalog items with 0 physical units
              </div>
            </div>
          </Col>

          {/* Health Item 3: Damaged / Non-sellable Stock (Neutral/Muted Slate) */}
          <Col xs={24} sm={12} lg={6}>
            <div
              onClick={() => navigate('/stock/maintenance?tab=all&status=damaged')}
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #64748b',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Damaged / Non-sellable
                </span>
                <ExclamationCircleOutlined style={{ color: '#64748b', fontSize: '16px' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginTop: '6px' }}>
                {formatIndianNumber(health?.damaged_stock)}{' '}
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>units</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                Quarantine, inspection & damaged
              </div>
            </div>
          </Col>

          {/* Health Item 4: Products with Stock Available (Green) */}
          <Col xs={24} sm={12} lg={6}>
            <div
              onClick={() => navigate('/products?stock_status=in_stock')}
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: '#f0fdf4',
                border: '1px solid #dcfce7',
                borderLeft: '4px solid #16a34a',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>
                  Stocked Products
                </span>
                <CheckCircleOutlined style={{ color: '#16a34a', fontSize: '16px' }} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803d', marginTop: '6px' }}>
                {formatIndianNumber(health?.products_with_stock)}
              </div>
              <div style={{ fontSize: '11.5px', color: '#14532d', marginTop: '4px' }}>
                Catalog products holding physical stock
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* PART 3: Middle Row — Section A: Inventory Ageing (Left) & Section B: Action Required (Right) */}
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[20, 20]}>
          {/* Section A: Inventory Ageing */}
          <Col xs={24} lg={13}>
            <Card
              style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '100%',
              }}
              bodyStyle={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                    Inventory Ageing
                  </Title>
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    FIFO cost distribution across layer age brackets
                  </Text>
                </div>
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate('/stock/ageing')}
                  style={{ padding: 0, fontSize: '13px', fontWeight: 600 }}
                >
                  View Full Ageing →
                </Button>
              </div>

              {/* Ageing Summary Metric Bar */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Total FIFO Value:
                  </Text>{' '}
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
                    {inv?.can_view_valuation
                      ? formatCurrencyINR(ageing?.total_valuation)
                      : 'Restricted'}
                  </span>
                </div>
                <Space size={8}>
                  <Tag color="blue" style={{ margin: 0, borderRadius: '4px' }}>
                    {formatIndianNumber(ageing?.total_quantity)} units tracked
                  </Tag>
                  <Tag color="purple" style={{ margin: 0, borderRadius: '4px' }}>
                    FIFO Layers
                  </Tag>
                </Space>
              </div>

              {/* Compact Horizontal Stacked Bar Distribution */}
              {Number(ageing?.total_valuation || 0) > 0 ? (
                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      height: '14px',
                      borderRadius: '7px',
                      background: '#f1f5f9',
                      display: 'flex',
                      overflow: 'hidden',
                      width: '100%',
                    }}
                  >
                    {ageing?.bands.map((b) => {
                      if (b.percentage <= 0) return null
                      return (
                        <Tooltip
                          key={b.category}
                          title={`${b.category} (${b.period}): ${formatCurrencyINR(b.valuation)} (${b.percentage}%)`}
                        >
                          <div
                            style={{
                              width: `${b.percentage}%`,
                              background: AGEING_BAND_COLORS[b.category] || '#94a3b8',
                              transition: 'width 0.3s',
                            }}
                          />
                        </Tooltip>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '12px' }} />
              )}

              {/* Ageing Category Breakdown Table Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {ageing?.bands && ageing.bands.length > 0 ? (
                  ageing.bands.map((b: AgeingBand) => {
                    const color = AGEING_BAND_COLORS[b.category] || '#64748b'
                    return (
                      <div
                        key={b.category}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: '#ffffff',
                          border: '1px solid #f1f5f9',
                        }}
                      >
                        <Space size={10} style={{ minWidth: '160px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: color,
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                            {b.category}
                          </span>
                          <Tag style={{ fontSize: '11px', margin: 0, padding: '0 6px', borderRadius: '4px' }}>
                            {b.period}
                          </Tag>
                        </Space>

                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                            {formatIndianNumber(b.quantity)} units
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#0f172a',
                              minWidth: '90px',
                              textAlign: 'right',
                            }}
                          >
                            {inv?.can_view_valuation
                              ? formatCurrencyINR(b.valuation)
                              : '—'}
                          </span>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: color,
                              minWidth: '45px',
                              textAlign: 'right',
                            }}
                          >
                            {b.percentage}%
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No stock layers recorded"
                    style={{ margin: 'auto' }}
                  />
                )}
              </div>
            </Card>
          </Col>

          {/* Section B: Action Required */}
          <Col xs={24} lg={11}>
            <Card
              style={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                height: '100%',
              }}
              bodyStyle={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <div style={{ marginBottom: '16px' }}>
                <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                  Action Required
                </Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  Operational alerts and pending workflow checkpoints
                </Text>
              </div>

              {!hasActions ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '32px 16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                  }}
                >
                  <CheckCircleFilled style={{ fontSize: '36px', color: '#10b981', marginBottom: '12px' }} />
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>
                    All stock operations are up to date
                  </div>
                  <Text type="secondary" style={{ fontSize: '13px', marginTop: '4px', maxWidth: '320px' }}>
                    No replenishment alerts, pending transfers, or ledger discrepancies requiring attention.
                  </Text>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {/* Action 1: Out of Stock Alert (Critical Red) */}
                  {(act?.out_of_stock_products || 0) > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderLeft: '4px solid #ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Space size={10} align="center">
                        <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#991b1b' }}>
                            Out of Stock ({formatIndianNumber(act?.out_of_stock_products)})
                          </div>
                          <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                            Products with zero available sellable units
                          </div>
                        </div>
                      </Space>
                      <Button
                        size="small"
                        type="primary"
                        danger
                        onClick={() => navigate('/products?stock_status=out_of_stock')}
                        style={{ borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}
                      >
                        View Products
                      </Button>
                    </div>
                  )}

                  {/* Action 2: Replenishment Required (Warning Amber) */}
                  {(act?.replenishment_products || 0) > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderLeft: '4px solid #f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Space size={10} align="center">
                        <WarningOutlined style={{ color: '#f59e0b', fontSize: '18px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#92400e' }}>
                            Replenishment Required ({formatIndianNumber(act?.replenishment_products)})
                          </div>
                          <div style={{ fontSize: '12px', color: '#b45309' }}>
                            Products below minimum reorder thresholds
                          </div>
                        </div>
                      </Space>
                      <Button
                        size="small"
                        onClick={() => navigate('/products?stock_status=low_stock')}
                        style={{
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderColor: '#f59e0b',
                          color: '#b45309',
                        }}
                      >
                        Review Stock
                      </Button>
                    </div>
                  )}

                  {/* Action 3: Pending Transfers (Blue/Processing) */}
                  {(act?.pending_transfers || 0) > 0 && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: '#eff6ff',
                        border: '1px solid #dbeafe',
                        borderLeft: '4px solid #3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Space size={10} align="center">
                        <SwapOutlined style={{ color: '#3b82f6', fontSize: '18px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#1e40af' }}>
                            Pending Stock Transfers ({formatIndianNumber(act?.pending_transfers)})
                          </div>
                          <div style={{ fontSize: '12px', color: '#2563eb' }}>
                            Dispatched transfers in transit awaiting receipt
                          </div>
                        </div>
                      </Space>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => navigate('/stock/transfers?status=DISPATCHED')}
                        style={{ borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: '#2563eb' }}
                      >
                        Receive
                      </Button>
                    </div>
                  )}

                  {/* Action 4: Stock Reconciliation */}
                  {!act?.reconciliation_balanced ? (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderLeft: '4px solid #dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Space size={10} align="center">
                        <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: '18px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#991b1b' }}>
                            Reconciliation Discrepancy ({formatIndianNumber(act?.reconciliation_discrepancies)})
                          </div>
                          <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                            Discrepancies found between ledger and balances
                          </div>
                        </div>
                      </Space>
                      <Button
                        size="small"
                        danger
                        onClick={() => navigate('/stock/movements')}
                        style={{ borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}
                      >
                        Audit Ledger
                      </Button>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        border: '1px solid #dcfce7',
                        borderLeft: '4px solid #16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Space size={10} align="center">
                        <CheckCircleOutlined style={{ color: '#16a34a', fontSize: '18px' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#166534' }}>
                            Stock Reconciliation: Balanced
                          </div>
                          <div style={{ fontSize: '12px', color: '#15803d' }}>
                            Running stock balances match movement transactions
                          </div>
                        </div>
                      </Space>
                      <Button
                        size="small"
                        type="link"
                        onClick={() => navigate('/stock/movements')}
                        style={{ padding: 0, fontSize: '12px', fontWeight: 600, color: '#15803d' }}
                      >
                        Audit Ledger →
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>

      {/* PART 4: Section C: Recent Stock Activity Table */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HistoryOutlined style={{ fontSize: '18px', color: '#2563eb' }} />
              <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
                Recent Stock Activity
              </Title>
            </div>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Latest inventory transactions across all locations (most recent first)
            </Text>
          </div>
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/stock/movements')}
            style={{ padding: 0, fontSize: '13px', fontWeight: 600 }}
          >
            View Full Movement Ledger →
          </Button>
        </div>

        <Table
          columns={activityColumns}
          dataSource={recentActivity}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 780 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No recent stock movements recorded"
              />
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default DashboardPage
