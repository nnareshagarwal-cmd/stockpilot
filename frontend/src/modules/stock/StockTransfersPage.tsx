import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Row,
  Col,
} from 'antd'
import {
  SwapOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  EyeOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import { stockApi, StockTransfer } from '../../api/stock'
import { cleanLocationName } from './StockBalancesPage'
import { ThinStatCard } from '../../components/common/ThinStatCard'

const { Title, Text } = Typography

export const StockTransfersPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [receiveModalOpen, setReceiveModalOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null)
  const [receiveForm] = Form.useForm()

  const fetchTransfers = async () => {
    setLoading(true)
    try {
      const res = await stockApi.getTransfers({
        status: statusFilter,
        page,
        page_size: pageSize,
      })
      setTransfers(res.data || [])
      setTotalItems(res.pagination?.total_items || 0)
    } catch (e) {
      message.error('Failed to load transfers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransfers()
  }, [page, pageSize, statusFilter])

  const handleReceiveSubmit = async () => {
    if (!selectedTransfer) return
    try {
      const values = await receiveForm.validateFields()
      const itemsPayload = selectedTransfer.items.map((it) => ({
        item_id: it.id,
        received_quantity: values[`item_${it.id}`] ?? it.quantity,
      }))

      await stockApi.receiveTransfer(selectedTransfer.id, {
        items: itemsPayload,
        notes: values.notes,
      })
      message.success(`Transfer ${selectedTransfer.transfer_number} received successfully!`)
      setReceiveModalOpen(false)
      receiveForm.resetFields()
      fetchTransfers()
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Receive failed'
      message.error(msg)
    }
  }

  const columns = [
    {
      title: 'Transfer #',
      dataIndex: 'transfer_number',
      key: 'transfer_number',
      render: (num: string) => (
        <Text strong style={{ color: '#2563eb', fontFamily: 'monospace' }}>
          {num}
        </Text>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      render: (_: any, record: StockTransfer) => (
        <Space size={6}>
          <Tag color="orange">
            <ShopOutlined /> {cleanLocationName(record.source_location_name || '')}
          </Tag>
          <Text type="secondary">→</Text>
          <Tag color="blue">
            <ShopOutlined /> {cleanLocationName(record.destination_location_name || '')}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => {
        const color = st === 'RECEIVED' ? 'success' : st === 'DISPATCHED' ? 'processing' : 'default'
        return <Tag color={color}>{st}</Tag>
      },
    },
    {
      title: 'Items',
      key: 'items_count',
      render: (_: any, record: StockTransfer) => {
        const totalQty = record.items.reduce((acc, it) => acc + Number(it.quantity || 0), 0)
        return (
          <Text>
            {record.items.length} SKUs ({totalQty} units)
          </Text>
        )
      },
    },
    {
      title: 'Dispatched At',
      dataIndex: 'dispatched_at',
      key: 'dispatched_at',
      render: (dateStr?: string) => (dateStr ? new Date(dateStr).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: StockTransfer) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTransfer(record)
              setDetailModalOpen(true)
            }}
          >
            Details
          </Button>
          {record.status === 'DISPATCHED' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setSelectedTransfer(record)
                const initial: Record<string, number> = {}
                record.items.forEach((it) => {
                  initial[`item_${it.id}`] = Number(it.quantity)
                })
                receiveForm.setFieldsValue(initial)
                setReceiveModalOpen(true)
              }}
            >
              Receive
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#111827' }}>
            Inter-Location Stock Transfers
          </Title>
          <Text type="secondary">
            Manage dispatch, in-transit items, and receiving workflows across godowns and showrooms.
          </Text>
        </div>
        <Space>
          <Select
            placeholder="Status Filter"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val)
              setPage(1)
            }}
            options={[
              { label: 'Dispatched (In-Transit)', value: 'DISPATCHED' },
              { label: 'Received (Completed)', value: 'RECEIVED' },
              { label: 'Draft', value: 'DRAFT' },
            ]}
          />
          <Button icon={<SyncOutlined />} onClick={fetchTransfers}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Metric Cards Strip - Thin & Colorful matching reference */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Total Transfers"
            value={totalItems}
            accentColor="#2563eb"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="In Transit (Dispatched)"
            value={transfers.filter((t) => t.status === 'DISPATCHED').length}
            accentColor="#ea580c"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Completed (Received)"
            value={transfers.filter((t) => t.status === 'RECEIVED').length}
            accentColor="#16a34a"
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Draft Orders"
            value={transfers.filter((t) => t.status === 'DRAFT').length}
            accentColor="#8b5cf6"
          />
        </Col>
      </Row>

      <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={transfers}
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

      {/* MODAL: Transfer Details */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#2563eb' }} />
            <span>Transfer Details — {selectedTransfer?.transfer_number}</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={650}
      >
        {selectedTransfer && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>From:</Text>
                  <div>
                    <Text strong>{cleanLocationName(selectedTransfer.source_location_name || '')}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>To:</Text>
                  <div>
                    <Text strong>{cleanLocationName(selectedTransfer.destination_location_name || '')}</Text>
                  </div>
                </Col>
              </Row>
              {selectedTransfer.notes && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#4b5563' }}>
                  <strong>Notes:</strong> {selectedTransfer.notes}
                </div>
              )}
            </div>

            <Table
              size="small"
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Product', dataIndex: 'product_name', key: 'product_name' },
                { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (s) => <Tag>{s}</Tag> },
                { title: 'Condition', dataIndex: 'condition_name', key: 'condition_name' },
                { title: 'Dispatched', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
                { title: 'Received', dataIndex: 'received_quantity', key: 'received_quantity', align: 'right' as const },
              ]}
              dataSource={selectedTransfer.items}
            />
          </div>
        )}
      </Modal>

      {/* MODAL: Receive Transfer */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#16a34a' }} />
            <span>Receive Transfer Items — {selectedTransfer?.transfer_number}</span>
          </Space>
        }
        open={receiveModalOpen}
        onOk={handleReceiveSubmit}
        onCancel={() => setReceiveModalOpen(false)}
        okText="Confirm Receipt & Update Stock"
        width={650}
        destroyOnClose
      >
        <Form form={receiveForm} layout="vertical">
          <p style={{ color: '#4b5563', fontSize: '13px' }}>
            Verify the physical quantities received into{' '}
            <strong>{cleanLocationName(selectedTransfer?.destination_location_name || '')}</strong>:
          </p>

          {selectedTransfer?.items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                marginBottom: 8,
                background: '#f9fafb',
                borderRadius: 6,
              }}
            >
              <div>
                <Text strong>{it.product_name}</Text>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  SKU: {it.sku} | Condition: {it.condition_name}
                </div>
              </div>
              <Form.Item
                name={`item_${it.id}`}
                label={`Dispatched: ${it.quantity}`}
                style={{ margin: 0 }}
                rules={[{ required: true, message: 'Quantity is required' }]}
              >
                <InputNumber min={0} max={Number(it.quantity)} style={{ width: 100 }} />
              </Form.Item>
            </div>
          ))}

          <Form.Item name="notes" label="Receiving Notes">
            <Input.TextArea rows={2} placeholder="e.g. Received in good condition with delivery challan" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
