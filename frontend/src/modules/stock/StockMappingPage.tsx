import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Select,
  TreeSelect,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Modal,
  Form,
  InputNumber,
  Input,
  Radio,
  message,
  Empty,
  Tooltip,
} from 'antd'
import {
  ShopOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import {
  stockApi,
  StockMappingResponse,
  StockMappingLocation,
} from '../../api/stock'
import apiClient from '../../api/client'
import { ThinStatCard } from '../../components/common/ThinStatCard'
import { mapLocationTreeToTreeData, AntdTreeDataNode } from './StockBalancesPage'

const { Title, Text } = Typography

export const StockMappingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialProductId = searchParams.get('product_id') || undefined

  // Product Selection State
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(initialProductId)
  const [productOptions, setProductOptions] = useState<Array<{ value: string; label: React.ReactNode; searchStr: string }>>([])
  const [searchingProducts, setSearchingProducts] = useState(false)

  // Mapping Data State
  const [mappingData, setMappingData] = useState<StockMappingResponse | null>(null)
  const [loadingMapping, setLoadingMapping] = useState(false)

  // Master Data
  const [locationTree, setLocationTree] = useState<AntdTreeDataNode[]>([])
  const [conditions, setConditions] = useState<Array<{ id: string; name: string; is_sellable: boolean }>>([])

  // Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [editingLocation, setEditingLocation] = useState<StockMappingLocation | null>(null)
  const [form] = Form.useForm()

  // 1. Load Locations tree and Stock Conditions once on mount
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [treeRes, condRes] = await Promise.all([
          apiClient.get('/locations?format=tree'),
          apiClient.get('/stock-conditions'),
        ])
        const rawTree = treeRes.data.data || []
        setLocationTree(mapLocationTreeToTreeData(rawTree))
        setConditions(condRes.data.data || [])
      } catch (e) {
        console.error('Failed to load locations or conditions', e)
      }
    }
    fetchMasters()
  }, [])

  // 2. Fetch product type-ahead search
  const handleProductSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      return
    }
    setSearchingProducts(true)
    try {
      const res = await apiClient.get(`/products?search=${encodeURIComponent(query.trim())}&page_size=15`)
      const items = res.data.data || []
      const opts = items.map((p: any) => ({
        value: p.id,
        searchStr: `${p.name} ${p.sku || ''} ${p.model || ''}`,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
              {p.model && <span style={{ marginLeft: 8, color: '#64748b', fontSize: '12px' }}>({p.model})</span>}
            </div>
            {p.sku && (
              <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                {p.sku}
              </Tag>
            )}
          </div>
        ),
      }))
      setProductOptions(opts)
    } catch (e) {
      console.error('Failed to search products', e)
    } finally {
      setSearchingProducts(false)
    }
  }

  // Load initial product if passed in URL or load recently updated products as default options
  useEffect(() => {
    apiClient
      .get('/products?page_size=15')
      .then((res) => {
        const items = res.data.data || []
        const opts = items.map((p: any) => ({
          value: p.id,
          searchStr: `${p.name} ${p.sku || ''} ${p.model || ''}`,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                {p.model && <span style={{ marginLeft: 8, color: '#64748b', fontSize: '12px' }}>({p.model})</span>}
              </div>
              {p.sku && (
                <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                  {p.sku}
                </Tag>
              )}
            </div>
          ),
        }))
        setProductOptions(opts)
        if (!selectedProductId && items.length > 0) {
          setSelectedProductId(items[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // 3. Load product stock mapping whenever selectedProductId changes
  const loadProductMapping = async (productId: string) => {
    setLoadingMapping(true)
    try {
      const data = await stockApi.getProductStockMapping(productId)
      setMappingData(data)
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to load stock mapping for product')
    } finally {
      setLoadingMapping(false)
    }
  }

  useEffect(() => {
    if (selectedProductId) {
      setSearchParams({ product_id: selectedProductId })
      loadProductMapping(selectedProductId)
    } else {
      setMappingData(null)
    }
  }, [selectedProductId])

  // Open Assign / Edit Modal
  const handleOpenAssignModal = (locRecord?: StockMappingLocation, defaultMode: 'add' | 'set_total' = 'set_total') => {
    if (!mappingData) return
    form.resetFields()

    if (locRecord) {
      setEditingLocation(locRecord)
      form.setFieldsValue({
        variant_id: locRecord.variant_id,
        location_id: locRecord.location_id,
        condition_id: locRecord.condition_id,
        mode: defaultMode,
        quantity: defaultMode === 'set_total' ? locRecord.quantity : 1,
        notes: '',
      })
    } else {
      setEditingLocation(null)
      const defaultVariant = mappingData.product.variants[0]?.id
      const defaultCondition = conditions.find((c) => c.is_sellable)?.id || conditions[0]?.id
      form.setFieldsValue({
        variant_id: defaultVariant,
        condition_id: defaultCondition,
        mode: 'set_total',
        quantity: 1,
        notes: '',
      })
    }
    setAssignModalOpen(true)
  }

  const handleSaveAllocation = async () => {
    if (!selectedProductId) return
    try {
      const values = await form.validateFields()
      setAssignLoading(true)

      const updated = await stockApi.allocateStock(selectedProductId, {
        variant_id: values.variant_id,
        location_id: values.location_id,
        condition_id: values.condition_id,
        quantity: Number(values.quantity),
        mode: values.mode,
        notes: values.notes,
      })

      message.success('Stock mapping updated successfully!')
      setMappingData(updated)
      setAssignModalOpen(false)
      form.resetFields()
      setEditingLocation(null)
    } catch (e: any) {
      if (e.errorFields) return
      message.error(e.response?.data?.detail || 'Failed to update stock allocation')
    } finally {
      setAssignLoading(false)
    }
  }

  const columns = [
    {
      title: 'Product Name',
      key: 'product_name',
      render: (_: any, record: StockMappingLocation) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
            {mappingData?.product.name}
          </div>
          <Space direction="horizontal" size={6} style={{ marginTop: 2 }}>
            {record.variant_name && record.variant_name !== 'Default' && record.variant_name !== mappingData?.product.name && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>{record.variant_name}</span>
            )}
            <Tag color="default" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
              {record.sku}
            </Tag>
          </Space>
        </div>
      ),
    },
    {
      title: 'Location (Showroom / Godown)',
      dataIndex: 'location_name',
      key: 'location_name',
      render: (_: any, record: StockMappingLocation) => (
        <Space direction="horizontal" size={6}>
          <ApartmentOutlined style={{ color: '#0284c7', fontSize: '15px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
              {record.location_name}
            </div>
            {record.location_code && (
              <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                [{record.location_code}]
              </span>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Stock Condition',
      dataIndex: 'condition_name',
      key: 'condition_name',
      render: (condName: string, record: StockMappingLocation) => (
        <Tag color={record.is_sellable ? 'success' : 'warning'} style={{ fontWeight: 600 }}>
          {condName}
        </Tag>
      ),
    },
    {
      title: 'Quantity in Location',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (qty: number) => (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
            {qty.toLocaleString()}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 4 }}>units</span>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 220,
      render: (_: any, record: StockMappingLocation) => (
        <Space direction="horizontal" size={8}>
          <Tooltip title="Add more units into this location">
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => handleOpenAssignModal(record, 'add')}
            >
              Add Units
            </Button>
          </Tooltip>
          <Tooltip title="Set exact quantity or clear stock">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenAssignModal(record, 'set_total')}
            >
              Adjust
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '0px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
            Stock Mapping
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Select a product to map inventory across showroom floors and godowns, view real-time available vs. sold stock, and allocate units.
          </Text>
        </div>
        {selectedProductId && (
          <Button
            icon={<ReloadOutlined />}
            loading={loadingMapping}
            onClick={() => loadProductMapping(selectedProductId)}
          >
            Refresh
          </Button>
        )}
      </div>

      {/* Product Selection Bar */}
      <Card
        style={{
          marginBottom: 16,
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          background: '#ffffff',
        }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10} lg={8}>
            <div style={{ marginBottom: 4, fontWeight: 600, fontSize: '13px', color: '#334155' }}>
              Select Product to Map:
            </div>
            <Select
              showSearch
              placeholder="Type product name, SKU or model..."
              value={selectedProductId}
              onChange={(val) => setSelectedProductId(val)}
              onSearch={handleProductSearch}
              filterOption={(input, option) =>
                (option?.searchStr || '').toLowerCase().includes(input.toLowerCase())
              }
              options={productOptions}
              loading={searchingProducts}
              style={{ width: '100%' }}
              size="large"
              notFoundContent={searchingProducts ? 'Searching...' : 'No products found'}
            />
          </Col>

          {/* Product Profile Strip if selected */}
          {mappingData?.product && (
            <Col xs={24} md={14} lg={16}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px 16px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                    Product:
                  </span>{' '}
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {mappingData.product.name}
                  </span>
                </div>

                {mappingData.product.category_name && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Category:
                    </span>{' '}
                    <Tag color="purple">{mappingData.product.category_name}</Tag>
                  </div>
                )}

                {mappingData.product.brand_name && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Brand:
                    </span>{' '}
                    <Tag color="geekblue">{mappingData.product.brand_name}</Tag>
                  </div>
                )}

                {mappingData.product.variants && mappingData.product.variants.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      SKU:
                    </span>
                    {mappingData.product.variants.map((v) => (
                      <Tag key={v.id} color="blue" style={{ fontFamily: 'monospace', margin: 0 }}>
                        {v.sku}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            </Col>
          )}
        </Row>
      </Card>

      {/* 3 Metric KPI Cards (Total Stock, Available to Sell, Total Sold) - NO RESERVED CONCEPT */}
      {mappingData && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <ThinStatCard
              label="TOTAL IN STOCK"
              value={`${mappingData.summary.total_stock} Units`}
              accentColor="#2563eb"
              badge="ON HAND"
            />
          </Col>
          <Col xs={24} sm={8}>
            <ThinStatCard
              label="AVAILABLE TO SELL"
              value={`${mappingData.summary.available_to_sell} Units`}
              accentColor="#16a34a"
              badge="SELLABLE"
            />
          </Col>
          <Col xs={24} sm={8}>
            <ThinStatCard
              label="TOTAL SOLD TILL NOW"
              value={`${mappingData.summary.total_sold} Units`}
              accentColor="#8b5cf6"
              badge="HISTORICAL"
            />
          </Col>
        </Row>
      )}

      {/* Location Mapping Table */}
      {selectedProductId && (
        <Card
          style={{
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            background: '#ffffff',
          }}
          bodyStyle={{ padding: '20px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                Stock Locations for this Product
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Showing only locations holding stock (&gt; 0). Locations with 0 stock are hidden automatically.
              </div>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenAssignModal()}
              style={{ background: '#2563eb' }}
            >
              + Assign / Add Stock at Location
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={mappingData?.locations || []}
            rowKey={(r) => `${r.location_id}-${r.variant_id}-${r.condition_id}`}
            loading={loadingMapping}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description={
                    <div style={{ padding: '20px 0' }}>
                      <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>
                        No stock currently allocated to any location
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px', marginTop: 4 }}>
                        This product has 0 units across all locations. Click "+ Assign / Add Stock at Location" to allocate stock.
                      </div>
                    </div>
                  }
                />
              ),
            }}
          />
        </Card>
      )}

      {/* Allocate / Edit Stock Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ApartmentOutlined style={{ color: '#2563eb', fontSize: '18px' }} />
            <span>
              {editingLocation ? 'Update Stock Allocation' : 'Assign Product Stock to Location'}
            </span>
          </div>
        }
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setEditingLocation(null)
          form.resetFields()
        }}
        onOk={handleSaveAllocation}
        confirmLoading={assignLoading}
        okText="Save Allocation"
        destroyOnClose
        width={540}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* Product Name Selection */}
          <Form.Item
            name="variant_id"
            label="Product Name"
            rules={[{ required: true, message: 'Please select product' }]}
          >
            <Select
              placeholder="Select product"
              disabled={!!editingLocation}
              options={
                mappingData?.product.variants.map((v) => ({
                  value: v.id,
                  label: (
                    <Space direction="horizontal" size={8}>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {mappingData.product.name}
                      </span>
                      {v.variant_name && v.variant_name !== 'Default' && v.variant_name !== mappingData.product.name && (
                        <span style={{ color: '#475569', fontSize: '13px' }}>
                          ({v.variant_name})
                        </span>
                      )}
                      <Tag color="default" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                        {v.sku}
                      </Tag>
                    </Space>
                  ),
                })) || []
              }
            />
          </Form.Item>

          {/* Location TreeSelect */}
          <Form.Item
            name="location_id"
            label="Showroom / Godown Location"
            rules={[{ required: true, message: 'Please choose a location' }]}
          >
            <TreeSelect
              showSearch
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              popupMatchSelectWidth={false}
              placeholder="Select showroom floor or godown..."
              allowClear
              treeDefaultExpandAll
              treeData={locationTree}
              disabled={!!editingLocation}
            />
          </Form.Item>

          {/* Stock Condition */}
          <Form.Item
            name="condition_id"
            label="Stock Condition"
            rules={[{ required: true, message: 'Please select condition' }]}
          >
            <Select
              placeholder="Select condition"
              disabled={!!editingLocation}
              options={conditions.map((c) => ({
                value: c.id,
                label: (
                  <Space direction="horizontal">
                    <Tag color={c.is_sellable ? 'success' : 'warning'}>{c.name}</Tag>
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          {/* Allocation Mode */}
          <Form.Item
            name="mode"
            label="Action Type"
            rules={[{ required: true }]}
          >
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="set_total">Set Exact Quantity (=)</Radio.Button>
              <Radio.Button value="add">Add Inward Units (+)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* Quantity */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.mode !== curr.mode}
          >
            {({ getFieldValue }) => {
              const mode = getFieldValue('mode')
              return (
                <Form.Item
                  name="quantity"
                  label={
                    mode === 'set_total'
                      ? 'Total Stock Quantity at this Location (set to 0 to remove)'
                      : 'Quantity of Units to Add'
                  }
                  rules={[
                    { required: true, message: 'Please specify quantity' },
                    {
                      validator: (_, value) => {
                        if (value === undefined || value === null) return Promise.resolve()
                        if (value < 0) return Promise.reject(new Error('Quantity cannot be negative'))
                        return Promise.resolve()
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{ width: '100%' }}
                    placeholder="Enter units..."
                    size="large"
                  />
                </Form.Item>
              )
            }}
          </Form.Item>

          {/* Notes */}
          <Form.Item name="notes" label="Notes / Reference (Optional)">
            <Input.TextArea
              rows={2}
              placeholder="e.g. Inward from supplier, floor restock, count correction..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default StockMappingPage
