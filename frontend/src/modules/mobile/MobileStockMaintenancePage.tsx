import React, { useState } from 'react'
import {
  Input,
  Card,
  Button,
  Tag,
  Typography,
  Spin,
  Empty,
  Modal,
  Form,
  Select,
  InputNumber,
  Segmented,
  message,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { stockApi, StockMappingLocation } from '../../api/stock'
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

export const MobileStockMaintenancePage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchItem | null>(null)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionType, setActionType] = useState<'allocate' | 'adjust'>('allocate')
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ['mobile-sm-search', searchTerm],
    queryFn: async () => {
      const url = searchTerm.trim()
        ? `/products/search?q=${encodeURIComponent(searchTerm.trim())}&page=1&page_size=20`
        : `/products/search?in_stock=true&page=1&page_size=20`
      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>(url)
      return res.data
    },
  })

  const {
    data: mapping,
    isLoading: loadingMapping,
    refetch: refetchMapping,
  } = useQuery({
    queryKey: ['mobile-sm-mapping', selectedProduct?.id],
    enabled: !!selectedProduct?.id,
    queryFn: () => stockApi.getProductStockMapping(selectedProduct!.id),
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

  const locationOptions = flattenLocations(locationsTree || [])

  const openModal = (type: 'allocate' | 'adjust', prefill?: StockMappingLocation) => {
    setActionType(type)
    form.resetFields()
    const firstVariant = mapping?.product?.variants?.[0]?.id
    const defaultCondition = conditions?.[0]?.id
    form.setFieldsValue({
      variant_id: prefill?.variant_id || firstVariant,
      location_id: prefill?.location_id,
      condition_id: prefill?.condition_id || defaultCondition,
      mode: 'add',
      quantity: 1,
      quantity_delta: 1,
      reason_code: 'CYCLE_COUNT',
      notes: '',
    })
    setActionOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedProduct) return
    try {
      const vals = await form.validateFields()
      setSubmitting(true)
      if (actionType === 'allocate') {
        await stockApi.allocateStock(selectedProduct.id, {
          variant_id: vals.variant_id,
          location_id: vals.location_id,
          condition_id: vals.condition_id,
          quantity: vals.quantity,
          mode: vals.mode,
          notes: vals.notes || undefined,
        })
        message.success('Stock updated successfully')
      } else {
        await stockApi.createAdjustment({
          variant_id: vals.variant_id,
          location_id: vals.location_id,
          condition_id: vals.condition_id,
          quantity_delta: vals.quantity_delta,
          reason_code: vals.reason_code,
          notes: vals.notes || undefined,
        })
        message.success('Stock adjustment recorded')
      }
      setActionOpen(false)
      refetchMapping()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.response?.data?.error?.message || 'Failed to update stock')
    } finally {
      setSubmitting(false)
    }
  }

  const products = searchData?.data || []

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 10, fontWeight: 700 }}>
        Stock Maintenance
      </Title>

      {!selectedProduct ? (
        <>
          <Input
            size="large"
            allowClear
            prefix={<SearchOutlined style={{ color: '#64748b' }} />}
            placeholder="Search product or SKU to update stock..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ borderRadius: 12, marginBottom: 12, height: 44 }}
          />
          {searching ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : products.length === 0 ? (
            <Empty description="No products found" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {products.map((p) => (
                <Card
                  key={p.id}
                  size="small"
                  hoverable
                  onClick={() => setSelectedProduct(p)}
                  style={{ borderRadius: 12 }}
                  bodyStyle={{ padding: '10px 12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {p.default_sku || 'No SKU'} {p.brand ? `· ${p.brand}` : ''}
                      </Text>
                    </div>
                    <Tag color={(p.total_stock ?? 0) > 0 ? 'green' : 'default'}>
                      {p.total_stock ?? 0} units
                    </Tag>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <Card style={{ borderRadius: 12, marginBottom: 12 }} bodyStyle={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedProduct.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Total Stock: {mapping?.summary?.total_stock ?? selectedProduct.total_stock ?? 0} units
                </Text>
              </div>
              <Button size="small" onClick={() => setSelectedProduct(null)}>
                Change
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ flex: 1, borderRadius: 8 }}
                onClick={() => openModal('allocate')}
              >
                Stock In / Allocate
              </Button>
              <Button
                icon={<EditOutlined />}
                style={{ flex: 1, borderRadius: 8 }}
                onClick={() => openModal('adjust')}
              >
                Adjust (+/-)
              </Button>
            </div>
          </Card>

          {loadingMapping ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Spin />
            </div>
          ) : !mapping?.locations || mapping.locations.length === 0 ? (
            <Card style={{ borderRadius: 12 }}>
              <Empty description="No stock balances at any location yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mapping.locations.map((loc: StockMappingLocation) => (
                <Card key={loc.id} size="small" style={{ borderRadius: 12 }} bodyStyle={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                        <EnvironmentOutlined /> {cleanLoc(loc.location_name)}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {loc.sku} · {loc.condition_name}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tag color={loc.quantity > 0 ? 'green' : 'default'} style={{ margin: 0 }}>
                        {loc.quantity} units
                      </Tag>
                      <Button size="small" onClick={() => openModal('adjust', loc)}>
                        Adjust
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        title={actionType === 'allocate' ? 'Stock In / Allocate' : 'Stock Adjustment (+/-)'}
        open={actionOpen}
        onCancel={() => setActionOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Variant" name="variant_id" rules={[{ required: true }]}>
            <Select
              options={(mapping?.product?.variants || []).map((v: any) => ({
                label: `${v.variant_name || 'Default'} (${v.sku})`,
                value: v.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="Location" name="location_id" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={locationOptions} placeholder="Select location" />
          </Form.Item>
          <Form.Item label="Condition" name="condition_id" rules={[{ required: true }]}>
            <Select
              options={(conditions || []).map((c: any) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>

          {actionType === 'allocate' ? (
            <>
              <Form.Item label="Mode" name="mode">
                <Segmented
                  block
                  options={[
                    { label: 'Add to Stock', value: 'add' },
                    { label: 'Set Exact Total', value: 'set_total' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="Quantity" name="quantity" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} size="large" />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                label="Quantity Delta (use negative e.g. -2 for Stock Out)"
                name="quantity_delta"
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Form.Item label="Reason" name="reason_code" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Cycle Count', value: 'CYCLE_COUNT' },
                    { label: 'Damaged / Shrinkage', value: 'DAMAGE' },
                    { label: 'Found / Surplus', value: 'FOUND' },
                    { label: 'Opening Stock', value: 'OPENING_STOCK' },
                    { label: 'Other', value: 'OTHER' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          <Form.Item label="Notes" name="notes">
            <Input placeholder="Optional remarks" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
