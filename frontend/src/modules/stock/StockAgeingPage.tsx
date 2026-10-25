import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  message,
  Alert,
} from 'antd'
import {
  ClockCircleOutlined,
  DollarCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { stockApi, AgeingSummary, AgeingItem, ReconciliationResponse } from '../../api/stock'
import { ThinStatCard } from '../../components/common/ThinStatCard'

const { Title, Text } = Typography

export const StockAgeingPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [ageing, setAgeing] = useState<AgeingSummary | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null)
  const [checkingRecon, setCheckingRecon] = useState(false)

  const fetchAgeing = async () => {
    setLoading(true)
    try {
      const data = await stockApi.getAgeing()
      setAgeing(data)
    } catch (e) {
      message.error('Failed to load ageing report')
    } finally {
      setLoading(false)
    }
  }

  const runReconciliation = async () => {
    setCheckingRecon(true)
    try {
      const data = await stockApi.getReconciliation()
      setReconciliation(data)
      if (data.is_balanced) {
        message.success(`Reconciliation verified! All ${data.total_checked} stock balance records match the movement ledger 100%.`)
      } else {
        message.warning(`Found ${data.mismatches.length} balance discrepancies!`)
      }
    } catch (e) {
      message.error('Reconciliation check failed')
    } finally {
      setCheckingRecon(false)
    }
  }

  useEffect(() => {
    fetchAgeing()
    runReconciliation()
  }, [])

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const columns = [
    {
      title: 'Product & SKU',
      key: 'product',
      render: (_: any, r: AgeingItem) => (
        <div>
          <Text strong style={{ fontSize: '13px' }}>{r.product_name}</Text>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            <Tag style={{ fontSize: '10.5px' }}>{r.sku}</Tag>
            {r.category_name && <span>• {r.category_name}</span>}
          </div>
        </div>
      ),
    },
    {
      title: 'Total Qty',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      align: 'right' as const,
      render: (q: number) => <Text strong>{Number(q).toLocaleString()}</Text>,
    },
    {
      title: '0–30 Days (Fresh)',
      key: 'band_0_30',
      align: 'right' as const,
      render: (_: any, r: AgeingItem) => (
        <span style={{ color: Number(r.bands['0-30 days']) > 0 ? '#16a34a' : '#9ca3af' }}>
          {Number(r.bands['0-30 days'] || 0)}
        </span>
      ),
    },
    {
      title: '31–60 Days',
      key: 'band_31_60',
      align: 'right' as const,
      render: (_: any, r: AgeingItem) => (
        <span style={{ color: Number(r.bands['31-60 days']) > 0 ? '#2563eb' : '#9ca3af' }}>
          {Number(r.bands['31-60 days'] || 0)}
        </span>
      ),
    },
    {
      title: '61–90 Days',
      key: 'band_61_90',
      align: 'right' as const,
      render: (_: any, r: AgeingItem) => (
        <span style={{ color: Number(r.bands['61-90 days']) > 0 ? '#ea580c' : '#9ca3af' }}>
          {Number(r.bands['61-90 days'] || 0)}
        </span>
      ),
    },
    {
      title: '91–180 Days (Slow)',
      key: 'band_91_180',
      align: 'right' as const,
      render: (_: any, r: AgeingItem) => (
        <span style={{ color: Number(r.bands['91-180 days']) > 0 ? '#dc2626' : '#9ca3af', fontWeight: 600 }}>
          {Number(r.bands['91-180 days'] || 0)}
        </span>
      ),
    },
    {
      title: '180+ Days (Dead Stock)',
      key: 'band_180_plus',
      align: 'right' as const,
      render: (_: any, r: AgeingItem) => {
        const qty = Number(r.bands['180+ days'] || 0)
        return (
          <Tag color={qty > 0 ? 'error' : 'default'} style={{ fontWeight: qty > 0 ? 700 : 400 }}>
            {qty}
          </Tag>
        )
      },
    },
    {
      title: 'Valuation (FIFO Cost)',
      dataIndex: 'total_valuation',
      key: 'total_valuation',
      align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: '#0f766e' }}>
          {formatINR(v)}
        </Text>
      ),
    },
  ]

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#111827' }}>
            Inventory Ageing & Valuation
          </Title>
          <Text type="secondary">
            FIFO receipt layer analysis identifying fresh vs slow-moving and dead stock duration.
          </Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchAgeing}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={checkingRecon}
            onClick={runReconciliation}
          >
            Check Reconciliation
          </Button>
        </Space>
      </div>

      {/* Reconciliation Alert Banner */}
      {reconciliation && (
        <Alert
          style={{ marginBottom: 16 }}
          message={
            reconciliation.is_balanced
              ? `Ledger Reconciled: 100% precision across ${reconciliation.total_checked} stock balance records.`
              : `Discrepancy Detected: ${reconciliation.mismatches.length} balance records differ from movement totals.`
          }
          type={reconciliation.is_balanced ? 'success' : 'error'}
          showIcon
          icon={reconciliation.is_balanced ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
        />
      )}

      {/* KPI Cards Strip - Thin & Colorful matching reference */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Total Inventory Value"
            value={formatINR(ageing?.total_valuation || 0)}
            accentColor="#0f766e"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Total Physical Units"
            value={ageing?.total_quantity || 0}
            accentColor="#2563eb"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Fresh Stock (0–30 Days)"
            value={ageing?.bands['0-30 days'] || 0}
            accentColor="#16a34a"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Slow Moving (91+ Days)"
            value={(Number(ageing?.bands['91-180 days'] || 0) + Number(ageing?.bands['180+ days'] || 0))}
            accentColor="#ea580c"
          />
        </Col>
      </Row>

      {/* Main Breakdown Table */}
      <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="variant_id"
          columns={columns}
          dataSource={ageing?.items || []}
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
