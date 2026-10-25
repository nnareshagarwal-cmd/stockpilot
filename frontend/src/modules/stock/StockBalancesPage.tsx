import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  AutoComplete,
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
  message,
  Statistic,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  SwapOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ShopOutlined,
  InboxOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { stockApi, StockBalanceItem } from '../../api/stock'
import apiClient from '../../api/client'
import { ThinStatCard } from '../../components/common/ThinStatCard'

const { Title, Text } = Typography

export const cleanLocationName = (name: string): string => {
  if (!name) return ''
  return name.replace(/\[.*?\]\s*/g, '').trim()
}

export interface AntdTreeDataNode {
  title: string
  value: string
  key: string
  style?: React.CSSProperties
  children?: AntdTreeDataNode[]
}

export const mapLocationTreeToTreeData = (items: any[]): AntdTreeDataNode[] => {
  return items.map((item) => {
    const node: AntdTreeDataNode = {
      title: cleanLocationName(item.name),
      value: String(item.id),
      key: String(item.id),
      style: { whiteSpace: 'nowrap' },
    }
    if (item.children && item.children.length > 0) {
      node.children = mapLocationTreeToTreeData(item.children)
    }
    return node
  })
}

export const StockBalancesPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [balances, setBalances] = useState<StockBalanceItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Summary Metrics from API
  const [summary, setSummary] = useState({
    total_on_hand: 0,
    sellable_units: 0,
    display_damaged_units: 0,
    reserved_units: 0,
    total_rows: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchOptions, setSearchOptions] = useState<Array<{ value: string; label: React.ReactNode }>>([])
  const [locationId, setLocationId] = useState<string | undefined>()
  const [conditionId, setConditionId] = useState<string | undefined>()
  const [statFilter, setStatFilter] = useState<'sellable' | 'damaged' | null>(null)

  // Dropdown options
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [locationTree, setLocationTree] = useState<AntdTreeDataNode[]>([])
  const [conditions, setConditions] = useState<Array<{ id: string; name: string; code: string }>>([])

  // Modals
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [conditionModalOpen, setConditionModalOpen] = useState(false)
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false)
  const [selectedBalance, setSelectedBalance] = useState<StockBalanceItem | null>(null)

  const [transferForm] = Form.useForm()
  const [conditionForm] = Form.useForm()
  const [adjustmentForm] = Form.useForm()

  const fetchLocationsAndConditions = async () => {
    try {
      const [treeRes, flatRes, condRes] = await Promise.all([
        apiClient.get('/locations?format=tree'),
        apiClient.get('/locations'),
        apiClient.get('/stock-conditions'),
      ])
      const rawTree = treeRes.data.data || []
      setLocationTree(mapLocationTreeToTreeData(rawTree))
      setLocations(flatRes.data.data || [])
      setConditions(condRes.data.data || [])
    } catch (e) {
      console.error('Failed to load master filters', e)
    }
  }

  const fetchBalances = async (overrideFilters?: {
    search?: string
    locationId?: string
    conditionId?: string
    statFilter?: 'sellable' | 'damaged' | null
    page?: number
  }) => {
    setLoading(true)
    try {
      const s = overrideFilters?.search !== undefined ? overrideFilters.search : debouncedSearch
      const loc = overrideFilters?.locationId !== undefined ? overrideFilters.locationId : locationId
      const cond = overrideFilters?.conditionId !== undefined ? overrideFilters.conditionId : conditionId
      const sf = overrideFilters?.statFilter !== undefined ? overrideFilters.statFilter : statFilter
      const p = overrideFilters?.page !== undefined ? overrideFilters.page : page

      let is_sellable: boolean | undefined = undefined
      if (sf === 'sellable') {
        is_sellable = true
      } else if (sf === 'damaged') {
        is_sellable = false
      }

      const res = await stockApi.getBalances({
        search: s?.trim() || undefined,
        location_id: loc,
        condition_id: cond,
        is_sellable,
        page: p,
        page_size: pageSize,
      })
      setBalances(res.data || [])
      setTotalItems(res.pagination?.total_items || 0)
      if ((res as any).summary) {
        setSummary((res as any).summary)
      }
    } catch (e) {
      message.error('Failed to load stock balances')
    } finally {
      setLoading(false)
    }
  }

  // 1. Debounce the search input by 300ms so typing automatically filters the data grid
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // 2. Fetch typeahead suggestions for the dropdown as the user types
  useEffect(() => {
    const q = search.trim()
    if (!q) {
      setSearchOptions([])
      return
    }

    let isMounted = true
    apiClient
      .get(`/products?search=${encodeURIComponent(q)}&page_size=8`)
      .then((res) => {
        if (!isMounted) return
        const products = res.data.data || []
        const options: Array<{ value: string; label: React.ReactNode }> = []
        const seen = new Set<string>()

        products.forEach((p: any) => {
          if (!seen.has(p.name)) {
            seen.add(p.name)
            options.push({
              value: p.name,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, fontSize: '13px' }}>{p.name}</span>
                  {p.sku && (
                    <Tag color="blue" style={{ fontSize: '11px', margin: 0, fontFamily: 'monospace' }}>
                      {p.sku}
                    </Tag>
                  )}
                </div>
              ),
            })
          }
        })
        setSearchOptions(options)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [search])

  useEffect(() => {
    fetchLocationsAndConditions()
  }, [])

  // 3. Grid data loader triggered automatically on debounced search, pagination, or filter change
  useEffect(() => {
    fetchBalances({
      search: debouncedSearch,
      locationId,
      conditionId,
      statFilter,
      page,
    })
  }, [debouncedSearch, page, pageSize, locationId, conditionId, statFilter])

  const handleClearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setSearchOptions([])
    setLocationId(undefined)
    setConditionId(undefined)
    setStatFilter(null)
    setPage(1)
    fetchBalances({
      search: '',
      locationId: undefined,
      conditionId: undefined,
      statFilter: null,
      page: 1,
    })
  }

  const handleStatCardClick = (type: 'sellable' | 'damaged' | 'all') => {
    if (type === 'all') {
      setStatFilter(null)
    } else {
      setStatFilter((prev) => (prev === type ? null : type))
    }
    setPage(1)
  }

  // Summary Metrics
  const totalQuantity = balances.reduce((acc, b) => acc + Number(b.quantity || 0), 0)
  const sellableQuantity = balances
    .filter((b) => b.is_sellable)
    .reduce((acc, b) => acc + Number(b.available_quantity || 0), 0)
  const nonSellableQuantity = totalQuantity - sellableQuantity

  // Action: Submit Transfer
  const handleTransferSubmit = async () => {
    try {
      const values = await transferForm.validateFields()
      await stockApi.createTransfer({
        source_location_id: values.source_location_id,
        destination_location_id: values.destination_location_id,
        notes: values.notes,
        items: [
          {
            variant_id: values.variant_id,
            condition_id: values.condition_id,
            quantity: values.quantity,
          },
        ],
      })
      message.success('Stock transfer dispatched successfully!')
      setTransferModalOpen(false)
      transferForm.resetFields()
      fetchBalances()
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Transfer failed'
      message.error(msg)
    }
  }

  // Action: Submit Condition Change
  const handleConditionSubmit = async () => {
    try {
      const values = await conditionForm.validateFields()
      await stockApi.changeCondition({
        variant_id: values.variant_id,
        location_id: values.location_id,
        from_condition_id: values.from_condition_id,
        to_condition_id: values.to_condition_id,
        quantity: values.quantity,
        notes: values.notes,
      })
      message.success('Condition change updated successfully!')
      setConditionModalOpen(false)
      conditionForm.resetFields()
      fetchBalances()
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Condition change failed'
      message.error(msg)
    }
  }

  // Action: Submit Adjustment
  const handleAdjustmentSubmit = async () => {
    try {
      const values = await adjustmentForm.validateFields()
      await stockApi.createAdjustment({
        variant_id: values.variant_id,
        location_id: values.location_id,
        condition_id: values.condition_id,
        quantity_delta: values.quantity_delta,
        reason_code: values.reason_code,
        notes: values.notes,
      })
      message.success('Stock adjustment posted successfully!')
      setAdjustmentModalOpen(false)
      adjustmentForm.resetFields()
      fetchBalances()
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Adjustment failed'
      message.error(msg)
    }
  }

  const columns = [
    {
      title: 'Product & SKU',
      key: 'product',
      render: (_: any, record: StockBalanceItem) => (
        <div>
          <Text strong style={{ fontSize: '13.5px', color: '#111827' }}>
            {record.product_name}
          </Text>
          {record.variant_name && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{record.variant_name}</div>
          )}
          <Tag color="default" style={{ marginTop: 3, fontSize: '11px', fontFamily: 'monospace' }}>
            {record.sku}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, record: StockBalanceItem) => (
        <Space direction="horizontal" size={4}>
          <ShopOutlined style={{ color: '#d97706' }} />
          <Text style={{ fontWeight: 500 }}>{cleanLocationName(record.location_name || '')}</Text>
        </Space>
      ),
    },
    {
      title: 'Condition',
      key: 'condition',
      render: (_: any, record: StockBalanceItem) => {
        const isGood = record.condition_name?.toLowerCase().includes('good')
        const isDamaged = record.condition_name?.toLowerCase().includes('damage')
        const color = isGood ? 'success' : isDamaged ? 'error' : 'purple'
        return <Tag color={color}>{record.condition_name}</Tag>
      },
    },
    {
      title: 'On Hand',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (qty: number) => (
        <Text strong style={{ fontSize: '14px' }}>
          {Number(qty).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Available to Sell',
      dataIndex: 'available_quantity',
      key: 'available_quantity',
      align: 'right' as const,
      render: (qty: number, record: StockBalanceItem) => (
        <Tag
          color={record.is_sellable && Number(qty) > 0 ? 'green' : 'default'}
          style={{ fontWeight: 600, fontSize: '13px', padding: '2px 8px' }}
        >
          {Number(qty).toLocaleString()}
        </Tag>
      ),
    },
    {
      title: 'Quick Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: StockBalanceItem) => (
        <Space size="small">
          <Tooltip title="Transfer stock to another room or godown">
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={() => {
                setSelectedBalance(record)
                transferForm.setFieldsValue({
                  variant_id: record.variant_id,
                  condition_id: record.condition_id,
                  source_location_id: record.location_id,
                  quantity: 1,
                })
                setTransferModalOpen(true)
              }}
            >
              Transfer
            </Button>
          </Tooltip>
          <Tooltip title="Mark as damaged or display sample">
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => {
                setSelectedBalance(record)
                conditionForm.setFieldsValue({
                  variant_id: record.variant_id,
                  location_id: record.location_id,
                  from_condition_id: record.condition_id,
                  quantity: 1,
                })
                setConditionModalOpen(true)
              }}
            >
              Condition
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0, color: '#111827', fontSize: '20px', fontWeight: 700 }}>
          Real-Time Stock Balances
        </Title>
        <Text type="secondary" style={{ fontSize: '13px' }}>
          Track physical inventory on-hand, available sellable units, and godown distribution.
        </Text>
      </div>

      {/* Metric Cards Strip - Thin, Colorful & Clickable Filter */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Total On Hand"
            value={summary.total_on_hand}
            accentColor="#2563eb"
            selected={statFilter === null}
            onClick={() => handleStatCardClick('all')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Sellable Units"
            value={summary.sellable_units}
            accentColor="#16a34a"
            selected={statFilter === 'sellable'}
            onClick={() => handleStatCardClick('sellable')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Display / Damaged"
            value={summary.display_damaged_units}
            accentColor="#ea580c"
            selected={statFilter === 'damaged'}
            onClick={() => handleStatCardClick('damaged')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Active Stock Rows"
            value={summary.total_rows || totalItems}
            accentColor="#8b5cf6"
            selected={statFilter === null}
            onClick={() => handleStatCardClick('all')}
          />
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card
        size="small"
        style={{ marginBottom: 14, borderRadius: 8, border: '1px solid #e5e7eb' }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 400px' }}>
            <div style={{ flex: '1 1 260px', minWidth: '180px' }}>
              <AutoComplete
                style={{ width: '100%' }}
                options={searchOptions}
                value={search}
                onChange={(val) => setSearch(val || '')}
                onSelect={(val) => {
                  setSearch(val)
                  setDebouncedSearch(val)
                  setPage(1)
                }}
                allowClear
                onClear={() => {
                  setSearch('')
                  setDebouncedSearch('')
                  setSearchOptions([])
                }}
              >
                <Input
                  placeholder="Search product name, SKU, variant..."
                  prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                  allowClear
                />
              </AutoComplete>
            </div>
            <div style={{ width: '230px', flexShrink: 0 }}>
              <TreeSelect
                style={{ width: '100%' }}
                placeholder="All Locations"
                allowClear
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
                popupMatchSelectWidth={false}
                dropdownStyle={{
                  minWidth: 320,
                  maxWidth: 550,
                  width: 'max-content',
                  whiteSpace: 'nowrap',
                }}
                value={locationId}
                onChange={(val) => {
                  setLocationId(val || undefined)
                  setPage(1)
                }}
                treeData={locationTree}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {statFilter && (
              <Tag
                color={statFilter === 'damaged' ? 'orange' : 'green'}
                closable
                onClose={() => setStatFilter(null)}
                style={{ margin: 0, fontWeight: 500, padding: '3px 8px' }}
              >
                Filtered: {statFilter === 'damaged' ? 'Display / Damaged' : 'Sellable Units'}
              </Tag>
            )}
            <Button onClick={handleClearFilters}>
              Clear Filters
            </Button>
            <Button onClick={() => fetchBalances()} icon={<SyncOutlined />}>
              Refresh
            </Button>
            <Button
              danger
              onClick={() => {
                adjustmentForm.resetFields()
                setAdjustmentModalOpen(true)
              }}
            >
              Stock Adjustment
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={balances}
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

      {/* MODAL: Inter-Location Transfer */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#2563eb' }} />
            <span>Inter-Location Stock Transfer</span>
          </Space>
        }
        open={transferModalOpen}
        onOk={handleTransferSubmit}
        onCancel={() => setTransferModalOpen(false)}
        okText="Dispatch Transfer"
        destroyOnClose
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item name="variant_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="condition_id" hidden>
            <Input />
          </Form.Item>

          <div style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
            <Text strong>{selectedBalance?.product_name}</Text>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              SKU: {selectedBalance?.sku} | Available:{' '}
              {Number(selectedBalance?.available_quantity || 0)} units
            </div>
          </div>

          <Form.Item
            name="source_location_id"
            label="Source Location"
            rules={[{ required: true, message: 'Please select source location' }]}
          >
            <Select
              disabled
              options={locations.map((loc) => ({
                label: cleanLocationName(loc.name),
                value: loc.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="destination_location_id"
            label="Destination Location"
            rules={[{ required: true, message: 'Please select destination location' }]}
          >
            <Select
              placeholder="Select destination store/godown"
              options={locations
                .filter((loc) => loc.id !== selectedBalance?.location_id)
                .map((loc) => ({
                  label: cleanLocationName(loc.name),
                  value: loc.id,
                }))}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Transfer Quantity"
            rules={[
              { required: true, message: 'Quantity is required' },
              {
                type: 'number',
                min: 1,
                max: Number(selectedBalance?.available_quantity || 1),
                message: `Must be between 1 and ${selectedBalance?.available_quantity}`,
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} precision={0} />
          </Form.Item>

          <Form.Item name="notes" label="Transfer Reason / Dispatch Notes">
            <Input.TextArea rows={2} placeholder="e.g. Floor replenishment or customer reserve" />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Condition Change */}
      <Modal
        title={
          <Space>
            <SyncOutlined style={{ color: '#8b5cf6' }} />
            <span>Condition Change (Good ↔ Damaged / Display)</span>
          </Space>
        }
        open={conditionModalOpen}
        onOk={handleConditionSubmit}
        onCancel={() => setConditionModalOpen(false)}
        okText="Update Condition"
        destroyOnClose
      >
        <Form form={conditionForm} layout="vertical">
          <Form.Item name="variant_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="location_id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="from_condition_id" hidden>
            <Input />
          </Form.Item>

          <div style={{ marginBottom: 12, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
            <Text strong>{selectedBalance?.product_name}</Text>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Location: {cleanLocationName(selectedBalance?.location_name || '')} | Current:{' '}
              {selectedBalance?.condition_name} ({selectedBalance?.quantity} units)
            </div>
          </div>

          <Form.Item
            name="to_condition_id"
            label="Target Condition"
            rules={[{ required: true, message: 'Please select new condition' }]}
          >
            <Select
              placeholder="Select target condition"
              options={conditions
                .filter((c) => c.id !== selectedBalance?.condition_id)
                .map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Quantity to Move"
            rules={[
              { required: true, message: 'Quantity is required' },
              {
                type: 'number',
                min: 1,
                max: Number(selectedBalance?.available_quantity || 1),
                message: `Cannot exceed ${selectedBalance?.available_quantity}`,
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} precision={0} />
          </Form.Item>

          <Form.Item name="notes" label="Reason for Condition Change" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="e.g. Scratched during customer trial, or floor sample setup" />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Stock Adjustment */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ef4444' }} />
            <span>Audited Physical Stock Adjustment</span>
          </Space>
        }
        open={adjustmentModalOpen}
        onOk={handleAdjustmentSubmit}
        onCancel={() => setAdjustmentModalOpen(false)}
        okText="Post Adjustment"
        destroyOnClose
      >
        <Form form={adjustmentForm} layout="vertical">
          <Form.Item
            name="variant_id"
            label="Product Variant"
            rules={[{ required: true, message: 'Please select variant' }]}
          >
            <Select
              showSearch
              placeholder="Search product variant by name or SKU"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={balances.map((b) => ({
                label: `${b.product_name} (${b.sku}) - ${cleanLocationName(b.location_name || '')}`,
                value: b.variant_id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="location_id"
            label="Location"
            rules={[{ required: true, message: 'Please select location' }]}
          >
            <TreeSelect
              placeholder="Select location"
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              treeData={locationTree}
            />
          </Form.Item>

          <Form.Item
            name="condition_id"
            label="Condition"
            rules={[{ required: true, message: 'Please select condition' }]}
          >
            <Select
              placeholder="Select condition"
              options={conditions.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="quantity_delta"
            label="Quantity Delta (+ to increase, - to decrease)"
            rules={[{ required: true, message: 'Please provide adjustment delta' }]}
            extra="e.g. -1 for damaged/lost item, or +2 for unrecorded intake"
          >
            <InputNumber style={{ width: '100%' }} precision={0} />
          </Form.Item>

          <Form.Item
            name="reason_code"
            label="Reason Code"
            rules={[{ required: true, message: 'Reason code is required' }]}
          >
            <Select
              placeholder="Select reason code"
              options={[
                { label: 'Damaged in Store', value: 'DAMAGED_IN_STORE' },
                { label: 'Physical Count Discrepancy', value: 'PHYSICAL_COUNT_DISCREPANCY' },
                { label: 'Clerical Correction', value: 'CLERICAL_ERROR' },
                { label: 'Display Sample Conversion', value: 'SAMPLE' },
                { label: 'Other', value: 'OTHER' },
              ]}
            />
          </Form.Item>

          <Form.Item name="notes" label="Audit Notes / Justification">
            <Input.TextArea rows={2} placeholder="Explain why this adjustment is being posted..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
