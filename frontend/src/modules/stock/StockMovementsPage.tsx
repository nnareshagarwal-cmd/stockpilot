import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Select,
  Row,
  Col,
  Input,
  message,
} from 'antd'
import {
  HistoryOutlined,
  SyncOutlined,
  SearchOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import { stockApi, StockMovementItem } from '../../api/stock'
import { cleanLocationName } from './StockBalancesPage'
import apiClient from '../../api/client'
import { ThinStatCard } from '../../components/common/ThinStatCard'

const { Title, Text } = Typography

export const StockMovementsPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [movements, setMovements] = useState<StockMovementItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [locationId, setLocationId] = useState<string | undefined>()
  const [movementType, setMovementType] = useState<string | undefined>()
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    apiClient.get('/locations').then((res) => {
      setLocations(res.data.data || [])
    })
  }, [])

  const fetchMovements = async () => {
    setLoading(true)
    try {
      const res = await stockApi.getMovements({
        location_id: locationId,
        movement_type: movementType,
        page,
        page_size: pageSize,
      })
      setMovements(res.data || [])
      setTotalItems(res.pagination?.total_items || 0)
    } catch (e) {
      message.error('Failed to load movement ledger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMovements()
  }, [page, pageSize, locationId, movementType])

  const getMovementTag = (type: string) => {
    switch (type) {
      case 'OPENING_STOCK':
        return <Tag color="blue">Opening Stock</Tag>
      case 'TRANSFER_IN':
        return <Tag color="green">+ Transfer In</Tag>
      case 'TRANSFER_OUT':
        return <Tag color="orange">- Transfer Out</Tag>
      case 'CONDITION_CHANGE':
        return <Tag color="purple">Condition Change</Tag>
      case 'ADJUSTMENT':
        return <Tag color="volcano">Adjustment</Tag>
      case 'SALE':
        return <Tag color="cyan">- Sale</Tag>
      case 'PURCHASE_RECEIPT':
        return <Tag color="geekblue">+ Purchase Receipt</Tag>
      default:
        return <Tag>{type}</Tag>
    }
  }

  const columns = [
    {
      title: 'Date & Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (d: string) => (
        <Text style={{ fontSize: '12.5px', color: '#4b5563' }}>
          {new Date(d).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Movement Type',
      dataIndex: 'movement_type',
      key: 'movement_type',
      width: 150,
      render: (t: string) => getMovementTag(t),
    },
    {
      title: 'Product & SKU',
      key: 'product',
      render: (_: any, r: StockMovementItem) => (
        <div>
          <Text strong style={{ fontSize: '13px' }}>{r.product_name}</Text>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            SKU: <Tag style={{ fontSize: '10.5px', padding: '0 4px' }}>{r.sku}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, r: StockMovementItem) => (
        <Space size={4}>
          <ShopOutlined style={{ color: '#d97706' }} />
          <span>{cleanLocationName(r.location_name || '')}</span>
        </Space>
      ),
    },
    {
      title: 'Condition',
      dataIndex: 'condition_name',
      key: 'condition_name',
      render: (c: string) => <Tag>{c}</Tag>,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (q: number) => {
        const isPositive = Number(q) > 0
        return (
          <Text
            strong
            style={{
              color: isPositive ? '#16a34a' : '#dc2626',
              fontSize: '13.5px',
            }}
          >
            {isPositive ? `+${Number(q)}` : Number(q)}
          </Text>
        )
      },
    },
    {
      title: 'Balance After',
      dataIndex: 'balance_after',
      key: 'balance_after',
      align: 'right' as const,
      render: (b: number) => (
        <Text strong style={{ color: '#111827' }}>
          {Number(b).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Reference / Notes',
      key: 'ref',
      render: (_: any, r: StockMovementItem) => (
        <div>
          {r.reference_number && (
            <Tag color="default" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
              {r.reference_number}
            </Tag>
          )}
          {r.notes && (
            <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: 2 }}>{r.notes}</div>
          )}
        </div>
      ),
    },
    {
      title: 'User',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (u?: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{u || 'System'}</Text>,
    },
  ]

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 14 }}>
        <Title level={3} style={{ margin: 0, color: '#111827', fontSize: '20px', fontWeight: 700 }}>
          Stock Movement Ledger
        </Title>
        <Text type="secondary" style={{ fontSize: '13px' }}>
          Immutable double-entry log of all historical inventory intakes, transfers, condition changes, and adjustments.
        </Text>
      </div>

      {/* Metric Cards Strip - Thin & Colorful matching reference */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Total Ledger Entries"
            value={totalItems}
            accentColor="#2563eb"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Showing on Page"
            value={movements.length}
            accentColor="#16a34a"
            badge={`Page ${page}`}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Locations Tracked"
            value={locations.length}
            accentColor="#8b5cf6"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Ledger Health"
            value={totalItems > 0 ? 'Synchronized' : 'Empty'}
            accentColor="#0f766e"
          />
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 14, borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={12} sm={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="All Locations"
              allowClear
              value={locationId}
              onChange={(v) => {
                setLocationId(v)
                setPage(1)
              }}
              options={locations.map((loc) => ({
                label: cleanLocationName(loc.name),
                value: loc.id,
              }))}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="All Movement Types"
              allowClear
              value={movementType}
              onChange={(v) => {
                setMovementType(v)
                setPage(1)
              }}
              options={[
                { label: 'Opening Stock', value: 'OPENING_STOCK' },
                { label: 'Transfer Out', value: 'TRANSFER_OUT' },
                { label: 'Transfer In', value: 'TRANSFER_IN' },
                { label: 'Condition Change', value: 'CONDITION_CHANGE' },
                { label: 'Adjustment', value: 'ADJUSTMENT' },
                { label: 'Sale', value: 'SALE' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
            <Button icon={<SyncOutlined />} onClick={fetchMovements}>
              Refresh Ledger
            </Button>
          </Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={movements}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: totalItems,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>
    </div>
  )
}
