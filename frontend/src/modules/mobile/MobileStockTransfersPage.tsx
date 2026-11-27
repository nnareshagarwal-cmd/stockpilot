import React, { useState } from 'react'
import {
  Card,
  Button,
  Tag,
  Typography,
  Segmented,
  Input,
  Spin,
  Empty,
  Modal,
  Form,
  Select,
  InputNumber,
  message,
} from 'antd'
import {
  SwapOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { stockApi, StockTransfer } from '../../api/stock'
import { PaginatedResponse, ProductSearchItem } from '../../api/types'

const { Title, Text } = Typography

const cleanLoc = (name?: string) => (name ? name.replace(/\s*\[.*?\]\s*/g, '').trim() : '')

const flattenLocations = (items: any[], prefix = ''): Array<{ label: string; value: string }> => {
  const out: Array<{ label: string; value: string }> = []
  for (const it of items || []) {
    const name = cleanLoc(it.name)
    const label = prefix ? `${prefix} → ${name}` : name
    out.push({ label, value: it.id })
    if (it.children && it.children.length > 0) {
      out.push(...flattenLocations(it.children, label))
    }
  }
  return out
}

export const MobileStockTransfersPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [receiveTarget, setReceiveTarget] = useState<StockTransfer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedProdId, setSelectedProdId] = useState<string | undefined>()

  const [receiveForm] = Form.useForm()
  const [createForm] = Form.useForm()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mobile-transfers', statusFilter, search],
    queryFn: () =>
      stockApi.getTransfers({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search.trim() || undefined,
        page: 1,
        page_size: 30,
      }),
  })

  const { data: locationsTree } = useQuery({
    queryKey: ['mobile-locations-tree'],
    queryFn: async () => {
      const res = await apiClient.get('/locations?format=tree')
      return res.data.data || []
    },
  })

  const { data: conditions } = useQuery({
    queryKey: ['mobile-stock-conditions'],
    queryFn: async () => {
      const res = await apiClient.get('/stock-conditions')
      return res.data.data || []
    },
  })

  const { data: productsRes } = useQuery({
    queryKey: ['mobile-transfer-products'],
    enabled: createOpen,
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>('/products/search?in_stock=true&page=1&page_size=50')
      return res.data.data || []
    },
  })

  const { data: selectedMapping } = useQuery({
    queryKey: ['mobile-transfer-mapping', selectedProdId],
    enabled: !!selectedProdId && createOpen,
    queryFn: () => stockApi.getProductStockMapping(selectedProdId!),
  })

  const locationOptions = flattenLocations(locationsTree || [])
  const transfers: StockTransfer[] = data?.data || []

  const openReceive = (t: StockTransfer) => {
    setReceiveTarget(t)
    const init: Record<string, any> = { notes: '' }
    t.items.forEach((it) => {
      init[`item_${it.id}`] = it.quantity
    })
    receiveForm.setFieldsValue(init)
  }

  const handleReceive = async () => {
    if (!receiveTarget) return
    try {
      const vals = await receiveForm.validateFields()
      setSubmitting(true)
      await stockApi.receiveTransfer(receiveTarget.id, {
        items: receiveTarget.items.map((it) => ({
          item_id: it.id,
          received_quantity: vals[`item_${it.id}`] ?? it.quantity,
        })),
        notes: vals.notes || undefined,
      })
      message.success(`Transfer ${receiveTarget.transfer_number} received`)
      setReceiveTarget(null)
      refetch()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.response?.data?.error?.message || 'Failed to receive transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateTransfer = async () => {
    try {
      const vals = await createForm.validateFields()
      if (vals.source_location_id === vals.destination_location_id) {
        message.error('Source and destination must be different')
        return
      }
      setSubmitting(true)
      await stockApi.createTransfer({
        source_location_id: vals.source_location_id,
        destination_location_id: vals.destination_location_id,
        notes: vals.notes || undefined,
        items: [
          {
            variant_id: vals.variant_id,
            condition_id: vals.condition_id,
            quantity: vals.quantity,
          },
        ],
      })
      message.success('Transfer created & dispatched')
      setCreateOpen(false)
      createForm.resetFields()
      setSelectedProdId(undefined)
      refetch()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.response?.data?.error?.message || 'Failed to create transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const statusColor = (status: string) => {
    if (status === 'RECEIVED') return 'green'
    if (status === 'DISPATCHED') return 'blue'
    if (status === 'CANCELLED') return 'red'
    return 'default'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          Stock Transfers
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            createForm.resetFields()
            if (conditions?.[0]?.id) {
              createForm.setFieldValue('condition_id', conditions[0].id)
            }
            createForm.setFieldValue('quantity', 1)
            setCreateOpen(true)
          }}
          style={{ borderRadius: 8 }}
        >
          New
        </Button>
      </div>

      <Segmented
        block
        value={statusFilter}
        onChange={(v) => setStatusFilter(String(v))}
        options={[
          { label: 'All', value: 'ALL' },
          { label: 'Dispatched', value: 'DISPATCHED' },
          { label: 'Received', value: 'RECEIVED' },
        ]}
        style={{ marginBottom: 10 }}
      />

      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: '#64748b' }} />}
        placeholder="Search transfer # or product..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ borderRadius: 10, marginBottom: 12, height: 40 }}
      />

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : transfers.length === 0 ? (
        <Empty description="No transfers found" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {transfers.map((t) => (
            <Card key={t.id} size="small" style={{ borderRadius: 12 }} bodyStyle={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text strong style={{ color: '#1677ff', fontFamily: 'monospace' }}>
                  {t.transfer_number}
                </Text>
                <Tag color={statusColor(t.status)} style={{ margin: 0 }}>
                  {t.status}
                </Tag>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                {cleanLoc(t.source_location_name)} <SwapOutlined /> {cleanLoc(t.destination_location_name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                {t.items.map((it) => (
                  <Text key={it.id} type="secondary" style={{ fontSize: 12 }}>
                    • {it.product_name || it.sku} ({it.quantity} units)
                  </Text>
                ))}
              </div>
              {t.status === 'DISPATCHED' && (
                <Button
                  type="primary"
                  size="small"
                  block
                  icon={<CheckCircleOutlined />}
                  onClick={() => openReceive(t)}
                  style={{ borderRadius: 8 }}
                >
                  Receive Transfer
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Receive Transfer Modal */}
      <Modal
        title={`Receive ${receiveTarget?.transfer_number || ''}`}
        open={!!receiveTarget}
        onCancel={() => setReceiveTarget(null)}
        onOk={handleReceive}
        confirmLoading={submitting}
      >
        <Form form={receiveForm} layout="vertical">
          {(receiveTarget?.items || []).map((it) => (
            <Form.Item
              key={it.id}
              label={`${it.product_name || it.sku} (Sent: ${it.quantity})`}
              name={`item_${it.id}`}
              rules={[{ required: true }]}
            >
              <InputNumber min={0} max={it.quantity} style={{ width: '100%' }} />
            </Form.Item>
          ))}
          <Form.Item label="Notes" name="notes">
            <Input placeholder="Optional receiving notes" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Transfer Modal */}
      <Modal
        title="New Stock Transfer"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreateTransfer}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="Product" name="product_id" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select product"
              onChange={(val) => {
                setSelectedProdId(val)
                createForm.setFieldValue('variant_id', undefined)
              }}
              options={(productsRes || []).map((p) => ({
                label: `${p.name} (${p.default_sku || 'No SKU'})`,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="Variant" name="variant_id" rules={[{ required: true }]}>
            <Select
              placeholder="Select variant"
              options={(selectedMapping?.product?.variants || []).map((v: any) => ({
                label: `${v.variant_name || 'Default'} (${v.sku})`,
                value: v.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="From Location" name="source_location_id" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={locationOptions} placeholder="Source location" />
          </Form.Item>
          <Form.Item label="To Location" name="destination_location_id" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={locationOptions} placeholder="Destination location" />
          </Form.Item>
          <Form.Item label="Condition" name="condition_id" rules={[{ required: true }]}>
            <Select options={(conditions || []).map((c: any) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Form.Item label="Quantity" name="quantity" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input placeholder="Optional transfer notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
