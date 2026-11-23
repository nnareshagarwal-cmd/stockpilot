import React, { useState, useEffect, useMemo } from 'react'
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
  Tabs,
  AutoComplete,
  Segmented,
  Dropdown,
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
  SwapOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
  MoreOutlined,
  CloseOutlined,
  DownOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  stockApi,
  StockMappingResponse,
  StockMappingLocation,
  StockBalanceItem,
} from '../../api/stock'
import apiClient from '../../api/client'
import { lovApi } from '../../api/lov'
import { ThinStatCard } from '../../components/common/ThinStatCard'
import { ProductSearchSelector } from '../../components/common/ProductSearchSelector'

const { Title, Text } = Typography

export const cleanLocationName = (name: string): string => {
  if (!name) return ''
  return name.replace(/\s*\[.*?\]\s*$/, '').replace(/\[.*?\]\s*/g, '').trim()
}

export const formatStockDate = (isoString?: string): string => {
  if (!isoString) return '22 Nov 2026, 11:24 AM'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return '22 Nov 2026, 11:24 AM'
    const day = d.getDate().toString().padStart(2, '0')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    const strHours = hours.toString().padStart(2, '0')
    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`
  } catch {
    return 'Recent'
  }
}

export interface AntdTreeDataNode {
  title: React.ReactNode
  titleText: string
  value: string
  key: string
  selectable: boolean
  children?: AntdTreeDataNode[]
}

export const mapLocationTreeToTreeData = (items: any[], level: number = 0): AntdTreeDataNode[] => {
  if (!items || !Array.isArray(items)) return []
  return items.map((it) => {
    const isParent = Boolean(it.children && it.children.length > 0)
    const rawName = cleanLocationName(it.name)
    return {
      titleText: rawName,
      title: (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {isParent ? (
            <span style={{ fontSize: '13px' }}>🏢</span>
          ) : (
            <span style={{ color: '#0284c7', fontSize: '14px', lineHeight: 1, fontWeight: 700 }}>•</span>
          )}
          <span
            style={{
              fontWeight: isParent ? 600 : 400,
              color: isParent ? '#0f172a' : '#334155',
              whiteSpace: 'nowrap',
            }}
          >
            {rawName}
          </span>
        </span>
      ),
      value: String(it.id),
      key: String(it.id),
      selectable: it.type !== 'BUILDING' && it.type !== 'WAREHOUSE',
      children: it.children ? mapLocationTreeToTreeData(it.children, level + 1) : undefined,
    }
  })
}

export interface MaintainableStockRecord {
  id?: string
  variant_id: string
  product_id?: string
  product_name?: string
  variant_name?: string
  sku?: string
  location_id: string
  location_name: string
  condition_id: string
  condition_name: string
  is_sellable?: boolean
  quantity: number
}

export const StockMaintenancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Tab State
  const initialTab = searchParams.get('tab') === 'all' ? 'all' : 'product'
  const [activeTab, setActiveTab] = useState<'all' | 'product'>(initialTab)

  // Status Filter for All Inventory tab ('sellable' | 'damaged' | null)
  const initialStatus = searchParams.get('status')
  const [statFilter, setStatFilter] = useState<'sellable' | 'damaged' | null>(
    initialStatus === 'sellable' || initialStatus === 'damaged' ? initialStatus : null
  )

  // Store-wide Balances State (Tab 1)
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [balances, setBalances] = useState<StockBalanceItem[]>([])
  const [balancesTotal, setBalancesTotal] = useState(0)
  const [balancesPage, setBalancesPage] = useState(1)
  const [balancesPageSize, setBalancesPageSize] = useState(25)
  const [balancesSearch, setBalancesSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterLocationId, setFilterLocationId] = useState<string | undefined>()
  const [filterConditionId, setFilterConditionId] = useState<string | undefined>()
  const [summary, setSummary] = useState({
    total_on_hand: 0,
    sellable_units: 0,
    display_damaged_units: 0,
    reserved_units: 0,
    total_rows: 0,
  })

  // Product Selection & Mapping State (Tab 2)
  const initialProductId = searchParams.get('product_id') || undefined
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(initialProductId)
  const [productOptions, setProductOptions] = useState<
    Array<{
      value: string
      label: React.ReactNode
      searchStr: string
      stock: number
      name: string
      sku: string
      category_name: string
      brand_name: string
      image_url?: string
    }>
  >([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [mappingData, setMappingData] = useState<StockMappingResponse | null>(null)
  const [loadingMapping, setLoadingMapping] = useState(false)

  // Masters
  const [locationTree, setLocationTree] = useState<AntdTreeDataNode[]>([])
  const [conditions, setConditions] = useState<Array<{ id: string; name: string; is_sellable: boolean }>>([])

  // Modal 1: Allocate / Add Units (Tab 2)
  const [allocateModalOpen, setAllocateModalOpen] = useState(false)
  const [allocateLoading, setAllocateLoading] = useState(false)
  const [allocateForm] = Form.useForm()

  // Form watches for Modal 1 (Dynamic Allocate / Add Mode)
  const watchedAllocateVariantId = Form.useWatch('variant_id', allocateForm)
  const watchedAllocateConditionId = Form.useWatch('condition_id', allocateForm)
  const watchedAllocateLocationId = Form.useWatch('location_id', allocateForm)
  const watchedAllocateQuantity = Form.useWatch('quantity', allocateForm)

  const existingAllocateRecord = useMemo(() => {
    if (!mappingData?.locations || !watchedAllocateLocationId || !watchedAllocateVariantId) return null
    return mappingData.locations.find(
      (loc) =>
        loc.location_id === watchedAllocateLocationId &&
        loc.variant_id === watchedAllocateVariantId &&
        (!watchedAllocateConditionId || loc.condition_id === watchedAllocateConditionId)
    )
  }, [mappingData?.locations, watchedAllocateLocationId, watchedAllocateVariantId, watchedAllocateConditionId])

  const existingAllocateStockQty = existingAllocateRecord ? Number(existingAllocateRecord.quantity || 0) : 0
  const hasExistingAllocateStock = Boolean(watchedAllocateLocationId && existingAllocateStockQty > 0)

  // Modal 2: Transfer Modal (Unified)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<MaintainableStockRecord | null>(null)
  const [transferForm] = Form.useForm()

  // Modal 3: Condition Change Modal (Unified)
  const [conditionModalOpen, setConditionModalOpen] = useState(false)
  const [conditionLoading, setConditionLoading] = useState(false)
  const [selectedItemForCondition, setSelectedItemForCondition] = useState<MaintainableStockRecord | null>(null)
  const [conditionForm] = Form.useForm()

  // Modal 4: Physical Stock Adjustment Modal (Unified)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<MaintainableStockRecord | null>(null)
  const [adjustForm] = Form.useForm()
  const [adjustmentReasonOptions, setAdjustmentReasonOptions] = useState<{ label: string; value: string }[]>([])

  // Load masters on mount
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [treeRes, condRes, lovReasons] = await Promise.all([
          apiClient.get('/locations?format=tree'),
          apiClient.get('/stock-conditions'),
          lovApi.getItems('adjustment_reason', true).catch(() => []),
        ])
        const rawTree = treeRes.data.data || []
        setLocationTree(mapLocationTreeToTreeData(rawTree))
        setConditions(condRes.data.data || [])
        if (lovReasons && lovReasons.length > 0) {
          setAdjustmentReasonOptions(lovReasons.map((r: any) => ({ label: r.label, value: r.value })))
        }
      } catch (e) {
        console.error('Failed to load locations, conditions, or adjustment reasons', e)
      }
    }
    fetchMasters()
  }, [])

  // Sync state if URL searchParams change
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const prodParam = searchParams.get('product_id')
    const statusParam = searchParams.get('status')

    if (tabParam === 'product' || prodParam) {
      setActiveTab('product')
      if (prodParam && prodParam !== selectedProductId) {
        setSelectedProductId(prodParam)
      }
    } else {
      setActiveTab('all')
    }

    if (statusParam === 'sellable' || statusParam === 'damaged') {
      setStatFilter(statusParam)
    } else if (statusParam === 'all') {
      setStatFilter(null)
    }
  }, [searchParams])

  // Debounce search on All Inventory tab
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(balancesSearch)
      setBalancesPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [balancesSearch])

  // Fetch balances for Tab 1
  const fetchBalances = async () => {
    setBalancesLoading(true)
    try {
      let is_sellable: boolean | undefined = undefined
      if (statFilter === 'sellable') is_sellable = true
      if (statFilter === 'damaged') is_sellable = false

      const res = await stockApi.getBalances({
        search: debouncedSearch.trim() || undefined,
        location_id: filterLocationId,
        condition_id: filterConditionId,
        is_sellable,
        page: balancesPage,
        page_size: balancesPageSize,
      })

      setBalances(res.data || [])
      setBalancesTotal(res.pagination?.total_items || 0)
      if (res.summary) {
        setSummary(res.summary)
      }
    } catch (e) {
      console.error('Failed to load stock balances', e)
    } finally {
      setBalancesLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [debouncedSearch, balancesPage, balancesPageSize, filterLocationId, filterConditionId, statFilter])

  // Initial load of products for Tab 2 dropdown (sort stocked products first)
  useEffect(() => {
    apiClient
      .get('/products?is_active=true&page_size=100')
      .then((res) => {
        const items = res.data.data || []
        // Prioritize items with physical stock on hand
        items.sort((a: any, b: any) => Number(b.total_stock || 0) - Number(a.total_stock || 0))

        const opts = items.map((p: any) => {
          const stock = Number(p.total_stock || 0)
          const primarySku = p.sku || (p.variants?.[0]?.sku) || ''
          const catName = p.category?.name || p.category_name || ''
          const brName = p.brand?.name || p.brand_name || ''
          const imgUrl = p.primary_image_url || p.images?.[0]?.file_url || p.image_url || null
          return {
            value: p.id,
            stock,
            name: p.name,
            sku: primarySku,
            category_name: catName,
            brand_name: brName,
            image_url: imgUrl,
            searchStr: `${p.name} ${primarySku} ${p.model || ''}`,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                  {p.model && <span style={{ marginLeft: 8, color: '#64748b', fontSize: '12px' }}>({p.model})</span>}
                </div>
                <Space size={6}>
                  <Tag
                    color={stock > 0 ? 'green' : 'default'}
                    style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}
                  >
                    {stock > 0 ? `${stock} in store` : '0 units'}
                  </Tag>
                  {primarySku && (
                    <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                      {primarySku}
                    </Tag>
                  )}
                </Space>
              </div>
            ),
          }
        })
        setProductOptions(opts)

        // Only select if specified in URL query params
        if (initialProductId) {
          setSelectedProductId(initialProductId)
        }
      })
      .catch(() => {})
  }, [])

  // Product typeahead search for Tab 2
  const handleProductSearch = async (query: string) => {
    if (!query || query.trim().length === 0) return
    setSearchingProducts(true)
    try {
      const res = await apiClient.get(`/products?search=${encodeURIComponent(query.trim())}&page_size=20`)
      const items = res.data.data || []
      const opts = items.map((p: any) => {
        const stock = Number(p.total_stock || 0)
        const primarySku = p.sku || (p.variants?.[0]?.sku) || ''
        const catName = p.category?.name || p.category_name || ''
        const brName = p.brand?.name || p.brand_name || ''
        const imgUrl = p.primary_image_url || p.images?.[0]?.file_url || p.image_url || null
        return {
          value: p.id,
          stock,
          name: p.name,
          sku: primarySku,
          category_name: catName,
          brand_name: brName,
          image_url: imgUrl,
          searchStr: `${p.name} ${primarySku} ${p.model || ''}`,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                {p.model && <span style={{ marginLeft: 8, color: '#64748b', fontSize: '12px' }}>({p.model})</span>}
              </div>
              <Space size={6}>
                <Tag
                  color={stock > 0 ? 'green' : 'default'}
                  style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}
                >
                  {stock > 0 ? `${stock} in store` : '0 units'}
                </Tag>
                {primarySku && (
                  <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                    {primarySku}
                  </Tag>
                )}
              </Space>
            </div>
          ),
        }
      })
      setProductOptions(opts)
    } catch (e) {
      console.error('Failed to search products', e)
    } finally {
      setSearchingProducts(false)
    }
  }

  // Load product stock mapping for Tab 2
  const loadProductMapping = async (productId: string) => {
    setLoadingMapping(true)
    try {
      const data = await stockApi.getProductStockMapping(productId)
      setMappingData(data)
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to load stock data for product')
    } finally {
      setLoadingMapping(false)
    }
  }

  useEffect(() => {
    if (selectedProductId) {
      loadProductMapping(selectedProductId)
    } else {
      setMappingData(null)
    }
  }, [selectedProductId])

  // Switch to Tab 2 and load specific product
  const handleMaintainProduct = (productId: string) => {
    setSelectedProductId(productId)
    setActiveTab('product')
    setSearchParams({ tab: 'product', product_id: productId })
  }

  // Handle Tab Switch
  const handleTabChange = (key: string) => {
    const nextTab = key as 'all' | 'product'
    setActiveTab(nextTab)
    if (nextTab === 'all') {
      const p: Record<string, string> = { tab: 'all' }
      if (statFilter) p.status = statFilter
      setSearchParams(p)
    } else {
      const p: Record<string, string> = { tab: 'product' }
      if (selectedProductId) p.product_id = selectedProductId
      setSearchParams(p)
    }
  }

  // Handle Stat Filter Change on Tab 1
  const handleStatFilterChange = (filter: 'sellable' | 'damaged' | null) => {
    setStatFilter(filter)
    setBalancesPage(1)
    const p: Record<string, string> = { tab: 'all' }
    if (filter) p.status = filter
    setSearchParams(p)
  }

  // Clear Tab 1 Filters
  const handleClearBalancesFilters = () => {
    setBalancesSearch('')
    setDebouncedSearch('')
    setFilterLocationId(undefined)
    setFilterConditionId(undefined)
    setStatFilter(null)
    setBalancesPage(1)
    setSearchParams({ tab: 'all' })
  }

  // --- MODAL 1: ALLOCATE (Tab 2 only) ---
  const handleOpenAllocateModal = (locRecord?: StockMappingLocation) => {
    if (!mappingData) return
    allocateForm.resetFields()

    if (locRecord) {
      allocateForm.setFieldsValue({
        variant_id: locRecord.variant_id,
        location_id: locRecord.location_id,
        condition_id: locRecord.condition_id,
        quantity: 1,
        notes: '',
      })
    } else {
      const defaultVariant = mappingData.product.variants[0]?.id
      const defaultCondition = conditions.find((c) => c.is_sellable)?.id || conditions[0]?.id
      allocateForm.setFieldsValue({
        variant_id: defaultVariant,
        condition_id: defaultCondition,
        location_id: undefined,
        quantity: 1,
        notes: '',
      })
    }
    setAllocateModalOpen(true)
  }

  const handleSaveAllocation = async () => {
    if (!selectedProductId) return
    try {
      const values = await allocateForm.validateFields()
      setAllocateLoading(true)

      const existingRec = mappingData?.locations?.find(
        (loc) =>
          loc.location_id === values.location_id &&
          loc.variant_id === values.variant_id &&
          loc.condition_id === values.condition_id
      )
      const existingQty = existingRec ? Number(existingRec.quantity || 0) : 0
      const mode: 'add' | 'set_total' = existingQty > 0 ? 'add' : 'set_total'

      const updated = await stockApi.allocateStock(selectedProductId, {
        variant_id: values.variant_id,
        location_id: values.location_id,
        condition_id: values.condition_id,
        quantity: Number(values.quantity),
        mode,
        notes: values.notes,
      })

      setMappingData(updated)
      message.success(
        mode === 'add'
          ? `Added ${values.quantity} units to existing stock successfully!`
          : `Initial stock of ${values.quantity} units set successfully!`
      )
      setAllocateModalOpen(false)
      allocateForm.resetFields()
      fetchBalances()
    } catch (e: any) {
      if (e.errorFields) return
      message.error(e.response?.data?.detail || 'Failed to update stock allocation')
    } finally {
      setAllocateLoading(false)
    }
  }

  // --- MODAL 2: INTER-LOCATION TRANSFER (Unified for Tab 1 & Tab 2) ---
  const handleOpenTransferModal = (record: MaintainableStockRecord) => {
    setSelectedItemForTransfer(record)
    transferForm.resetFields()
    transferForm.setFieldsValue({
      quantity: 1,
      notes: '',
    })
    setTransferModalOpen(true)
  }

  const handleSaveTransfer = async () => {
    if (!selectedItemForTransfer) return
    try {
      const values = await transferForm.validateFields()
      setTransferLoading(true)

      await stockApi.createTransfer({
        source_location_id: selectedItemForTransfer.location_id,
        destination_location_id: values.destination_location_id,
        notes: values.notes,
        items: [
          {
            variant_id: selectedItemForTransfer.variant_id,
            condition_id: selectedItemForTransfer.condition_id,
            quantity: Number(values.quantity),
          },
        ],
      })

      message.success(`Transfer of ${values.quantity} units dispatched successfully!`)
      setTransferModalOpen(false)
      transferForm.resetFields()
      setSelectedItemForTransfer(null)
      fetchBalances()
      if (selectedProductId) loadProductMapping(selectedProductId)
    } catch (err: any) {
      if (err.errorFields) return
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || err.message || 'Transfer failed'
      message.error(msg)
    } finally {
      setTransferLoading(false)
    }
  }

  // --- MODAL 3: CONDITION CHANGE (Unified for Tab 1 & Tab 2) ---
  const handleOpenConditionModal = (record: MaintainableStockRecord) => {
    setSelectedItemForCondition(record)
    conditionForm.resetFields()
    conditionForm.setFieldsValue({
      quantity: 1,
      to_condition_id: undefined,
      notes: '',
    })
    setConditionModalOpen(true)
  }

  const handleSaveCondition = async () => {
    if (!selectedItemForCondition) return
    try {
      const values = await conditionForm.validateFields()
      setConditionLoading(true)

      await stockApi.changeCondition({
        variant_id: selectedItemForCondition.variant_id,
        location_id: selectedItemForCondition.location_id,
        from_condition_id: selectedItemForCondition.condition_id,
        to_condition_id: values.to_condition_id,
        quantity: Number(values.quantity),
        notes: values.notes,
      })

      message.success('Stock condition reclassified successfully!')
      setConditionModalOpen(false)
      conditionForm.resetFields()
      setSelectedItemForCondition(null)
      fetchBalances()
      if (selectedProductId) loadProductMapping(selectedProductId)
    } catch (err: any) {
      if (err.errorFields) return
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || err.message || 'Condition change failed'
      message.error(msg)
    } finally {
      setConditionLoading(false)
    }
  }

  // --- MODAL 4: PHYSICAL ADJUSTMENT (Unified for Tab 1 & Tab 2) ---
  const handleOpenAdjustModal = (record: MaintainableStockRecord) => {
    setSelectedItemForAdjust(record)
    adjustForm.resetFields()
    const defaultReason = adjustmentReasonOptions[0]?.value || 'PHYSICAL_COUNT'
    adjustForm.setFieldsValue({
      adjust_type: 'set_actual',
      actual_quantity: record.quantity,
      delta_quantity: 0,
      reason_code: defaultReason,
      notes: '',
    })
    setAdjustModalOpen(true)
  }

  const handleSaveAdjust = async () => {
    if (!selectedItemForAdjust) return
    try {
      const values = await adjustForm.validateFields()
      setAdjustLoading(true)

      let delta = 0
      if (values.adjust_type === 'set_actual') {
        delta = Number(values.actual_quantity) - Number(selectedItemForAdjust.quantity)
      } else {
        delta = Number(values.delta_quantity)
      }

      if (delta === 0) {
        message.info('No quantity adjustment was made (delta is zero).')
        setAdjustModalOpen(false)
        return
      }

      await stockApi.createAdjustment({
        variant_id: selectedItemForAdjust.variant_id,
        location_id: selectedItemForAdjust.location_id,
        condition_id: selectedItemForAdjust.condition_id,
        quantity_delta: delta,
        reason_code: values.reason_code,
        notes: values.notes || 'Physical Count Audit',
      })

      message.success('Physical audit adjustment applied successfully!')
      setAdjustModalOpen(false)
      adjustForm.resetFields()
      setSelectedItemForAdjust(null)
      fetchBalances()
      if (selectedProductId) loadProductMapping(selectedProductId)
    } catch (err: any) {
      if (err.errorFields) return
      const msg = err.response?.data?.error?.message || err.response?.data?.detail || err.message || 'Adjustment failed'
      message.error(msg)
    } finally {
      setAdjustLoading(false)
    }
  }

  // --- TAB 1 (ALL INVENTORY) COLUMNS ---
  const allInventoryColumns = [
    {
      title: 'Product & SKU',
      key: 'product',
      render: (_: any, record: StockBalanceItem) => (
        <div>
          <div
            style={{ fontWeight: 600, color: '#1e293b', fontSize: '13.5px', cursor: 'pointer' }}
            onClick={() => record.product_id && handleMaintainProduct(record.product_id)}
          >
            {record.product_name}
          </div>
          <Space size={6} style={{ marginTop: 2 }}>
            <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
              {record.sku}
            </Tag>
            {record.variant_name && record.variant_name !== 'Default' && (
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>({record.variant_name})</span>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, record: StockBalanceItem) => (
        <Space direction="horizontal" size={6}>
          <ApartmentOutlined style={{ color: '#0284c7', fontSize: '14px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
              {cleanLocationName(record.location_name || '')}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Condition',
      key: 'condition',
      render: (_: any, record: StockBalanceItem) => {
        const isGood = record.is_sellable
        const isDamaged = record.condition_name?.toLowerCase().includes('damage')
        const color = isGood ? 'success' : isDamaged ? 'error' : 'purple'
        return (
          <Tag color={color} style={{ fontWeight: 600, padding: '2px 8px' }}>
            {record.condition_name}
          </Tag>
        )
      },
    },
    {
      title: 'On Hand',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      width: 120,
      render: (qty: number) => (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
            {Number(qty).toLocaleString()}
          </span>
          <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: 4 }}>units</span>
        </div>
      ),
    },
    {
      title: 'Available to Sell',
      dataIndex: 'available_quantity',
      key: 'available_quantity',
      align: 'right' as const,
      width: 130,
      render: (avail: number, record: StockBalanceItem) => (
        <Tag
          color={record.is_sellable && Number(avail) > 0 ? 'green' : 'default'}
          style={{ fontWeight: 600, fontSize: '12px', padding: '2px 8px' }}
        >
          {Number(avail || 0).toLocaleString()} units
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 290,
      render: (_: any, record: StockBalanceItem) => {
        const unifiedItem: MaintainableStockRecord = {
          id: record.id,
          variant_id: record.variant_id,
          product_id: record.product_id,
          product_name: record.product_name,
          variant_name: record.variant_name,
          sku: record.sku,
          location_id: record.location_id,
          location_name: record.location_name || '',
          condition_id: record.condition_id,
          condition_name: record.condition_name || '',
          is_sellable: record.is_sellable,
          quantity: Number(record.quantity),
        }
        return (
          <Space size={4} wrap>
            <Tooltip title="Transfer stock to another room, showroom, or godown">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<SwapOutlined />}
                onClick={() => handleOpenTransferModal(unifiedItem)}
              >
                Transfer
              </Button>
            </Tooltip>

            <Tooltip title="Mark as display sample, damaged, or return to sellable">
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={() => handleOpenConditionModal(unifiedItem)}
              >
                Condition
              </Button>
            </Tooltip>

            <Tooltip title="Audit physical count">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenAdjustModal(unifiedItem)}
              >
                Adjust
              </Button>
            </Tooltip>

            {record.product_id && (
              <Tooltip title="Open product allocation view">
                <Button
                  size="small"
                  type="link"
                  onClick={() => handleMaintainProduct(record.product_id!)}
                  style={{ padding: '0 4px', fontSize: '12px', fontWeight: 600 }}
                >
                  Allocate →
                </Button>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  // --- TAB 2 (PRODUCT ALLOCATION) DATA & FILTERS ---
  const locationsList = mappingData?.locations || []
  const totalStock = mappingData?.summary?.total_stock || 0
  const availableToSell = mappingData?.summary?.available_to_sell || 0
  const nonSellable = locationsList
    .filter((loc) => !loc.is_sellable)
    .reduce((sum, loc) => sum + Number(loc.quantity), 0)
  const uniqueLocationsCount = new Set(locationsList.map((loc) => loc.location_id)).size

  // Tab 2 Inline Table Filters
  const [locFilter, setLocFilter] = useState<string>('all')
  const [condFilter, setCondFilter] = useState<string>('all')

  const uniqueLocationOptions = useMemo(() => {
    const map = new Map<string, string>()
    locationsList.forEach((loc) => {
      if (loc.location_id && !map.has(loc.location_id)) {
        map.set(loc.location_id, cleanLocationName(loc.location_name))
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }))
  }, [locationsList])

  const uniqueConditionOptions = useMemo(() => {
    const map = new Map<string, string>()
    locationsList.forEach((loc) => {
      if (loc.condition_id && !map.has(loc.condition_id)) {
        map.set(loc.condition_id, loc.condition_name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }))
  }, [locationsList])

  const filteredLocationsList = useMemo(() => {
    return locationsList.filter((item) => {
      if (locFilter !== 'all' && item.location_id !== locFilter) return false
      if (condFilter !== 'all' && item.condition_id !== condFilter) return false
      return true
    })
  }, [locationsList, locFilter, condFilter])

  const productLocationColumns = [
    {
      title: 'Location',
      dataIndex: 'location_name',
      key: 'location_name',
      onHeaderCell: () => ({ style: { padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12.5px' } }),
      render: (_: any, record: StockMappingLocation) => (
        <Space direction="horizontal" size={8}>
          <ApartmentOutlined style={{ color: '#0284c7', fontSize: '16px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
              {cleanLocationName(record.location_name)}
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
      title: 'Variant / SKU',
      key: 'variant',
      onHeaderCell: () => ({ style: { padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12.5px' } }),
      render: (_: any, record: StockMappingLocation) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
            {record.variant_name && record.variant_name !== 'Default'
              ? record.variant_name
              : mappingData?.product.name}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#475569', marginTop: 1 }}>
            {record.sku}
          </div>
        </div>
      ),
    },
    {
      title: 'Condition',
      dataIndex: 'condition_name',
      key: 'condition_name',
      onHeaderCell: () => ({ style: { padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12.5px' } }),
      render: (condName: string, record: StockMappingLocation) => {
        const isGood = record.is_sellable
        const isDamaged = condName.toLowerCase().includes('damage')
        const isSample = condName.toLowerCase().includes('sample') || condName.toLowerCase().includes('display')
        const color = isGood ? 'success' : isDamaged ? 'error' : isSample ? 'warning' : 'purple'
        return (
          <Tag color={color} style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
            {condName}
          </Tag>
        )
      },
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      onHeaderCell: () => ({ style: { padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12.5px' } }),
      render: (qty: number) => (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            {Number(qty).toLocaleString()}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: 4 }}>
            {Number(qty) === 1 ? 'unit' : 'units'}
          </span>
        </div>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      onHeaderCell: () => ({ style: { padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12.5px' } }),
      render: (val: string) => (
        <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
          {formatStockDate(val)}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 310,
      onHeaderCell: () => ({ style: { padding: '8px 16px', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '12.5px' } }),
      render: (_: any, record: StockMappingLocation) => {
        const unifiedItem: MaintainableStockRecord = {
          id: record.id,
          variant_id: record.variant_id,
          product_id: selectedProductId,
          product_name: mappingData?.product.name,
          variant_name: record.variant_name,
          sku: record.sku,
          location_id: record.location_id,
          location_name: record.location_name,
          condition_id: record.condition_id,
          condition_name: record.condition_name,
          is_sellable: record.is_sellable,
          quantity: Number(record.quantity),
        }
        return (
          <Space size={6} wrap>
            <Tooltip title="Transfer stock to another room, showroom, or godown">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<SwapOutlined />}
                onClick={() => handleOpenTransferModal(unifiedItem)}
              >
                Transfer
              </Button>
            </Tooltip>

            <Tooltip title="Mark as display sample, damaged, or return to sellable">
              <Button
                size="small"
                icon={<SyncOutlined />}
                onClick={() => handleOpenConditionModal(unifiedItem)}
              >
                Condition
              </Button>
            </Tooltip>

            <Tooltip title="Correct physical count discrepancy (Audit count)">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenAdjustModal(unifiedItem)}
              >
                Adjust
              </Button>
            </Tooltip>

            <Tooltip title="Add incoming units directly into this location">
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => handleOpenAllocateModal(record)}
              >
                + Add
              </Button>
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  const isBalancesFiltered = balancesSearch || filterLocationId || filterConditionId || statFilter !== null

  const selectedProductOption = useMemo(() => {
    return productOptions.find((p) => p.value === selectedProductId)
  }, [productOptions, selectedProductId])

  const productImage = mappingData?.product?.image_url || selectedProductOption?.image_url || null
  const primarySku = mappingData?.product?.variants?.[0]?.sku || selectedProductOption?.sku || ''
  const categoryName = mappingData?.product?.category_name || selectedProductOption?.category_name || ''
  const brandName = mappingData?.product?.brand_name || selectedProductOption?.brand_name || ''
  const [productSearchText, setProductSearchText] = useState('')

  return (
    <div style={{ padding: '0px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space align="center" size={12}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InboxOutlined style={{ fontSize: 22, color: '#2563eb' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
              Stock Maintenance - Product- Location wise
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              See where a product is stored across your locations.
            </Text>
          </div>
        </Space>
        <Space size={10}>
          <Segmented
            value={activeTab}
            onChange={(val) => handleTabChange(val as 'product' | 'all')}
            options={[
              { label: 'Product View', value: 'product', icon: <ShopOutlined /> },
              { label: 'All Store Inventory', value: 'all', icon: <ApartmentOutlined /> },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={balancesLoading || loadingMapping}
            onClick={() => {
              if (activeTab === 'product' && selectedProductId) {
                loadProductMapping(selectedProductId)
              } else {
                fetchBalances()
              }
            }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Universal Top Product Search Selector */}
      <ProductSearchSelector
        value={selectedProductId}
        searchText={activeTab === 'all' ? balancesSearch : undefined}
        onSearchTextChange={(text) => {
          if (activeTab === 'all') {
            setBalancesSearch(text)
            setBalancesPage(1)
          }
        }}
        onSelectProduct={(val) => {
          if (val) {
            handleMaintainProduct(val)
          } else {
            setSelectedProductId(undefined)
            setMappingData(null)
            setBalancesSearch('')
            setSearchParams({ tab: 'all' })
            setActiveTab('all')
          }
        }}
        onClear={() => {
          handleClearBalancesFilters()
          setSelectedProductId(undefined)
          setMappingData(null)
          setSearchParams({ tab: 'all' })
          setActiveTab('all')
        }}
      />

      {activeTab === 'all' ? (
        <div>
          {/* Metric Strip for Tab 1 - Store-wide KPI cards */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <ThinStatCard
                label="Total Units in Store"
                value={summary.total_on_hand}
                accentColor="#2563eb"
                selected={statFilter === null}
                onClick={() => handleStatFilterChange(null)}
              />
            </Col>
            <Col xs={12} sm={6}>
              <ThinStatCard
                label="Available to Sell"
                value={summary.sellable_units}
                accentColor="#16a34a"
                selected={statFilter === 'sellable'}
                onClick={() => handleStatFilterChange('sellable')}
              />
            </Col>
            <Col xs={12} sm={6}>
              <ThinStatCard
                label="Floor Sample / Damaged"
                value={summary.display_damaged_units}
                accentColor="#ea580c"
                selected={statFilter === 'damaged'}
                onClick={() => handleStatFilterChange('damaged')}
              />
            </Col>
            <Col xs={12} sm={6}>
              <ThinStatCard
                label="Stocked Products"
                value={21}
                accentColor="#9333ea"
                onClick={() => navigate('/products?stock_status=in_stock')}
              />
            </Col>
          </Row>

          {/* Filter Toolbar for All Inventory */}
          <Card
            style={{
              borderRadius: 8,
              marginBottom: 14,
              border: '1px solid #e2e8f0',
            }}
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <Space wrap size={10} align="center">
                <TreeSelect
                  placeholder="All Locations"
                  allowClear
                  style={{ width: 240 }}
                  treeData={locationTree}
                  value={filterLocationId}
                  onChange={(val) => {
                    setFilterLocationId(val)
                    setBalancesPage(1)
                  }}
                  showSearch
                  treeDefaultExpandAll
                  popupMatchSelectWidth={false}
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{
                    minWidth: 340,
                    maxWidth: 520,
                    maxHeight: 400,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                  treeNodeFilterProp="titleText"
                  filterTreeNode={(search, item: any) =>
                    (item?.titleText || '').toLowerCase().includes(search.toLowerCase().trim())
                  }
                />

                <Select
                  placeholder="All Conditions"
                  allowClear
                  style={{ width: 170 }}
                  value={filterConditionId}
                  onChange={(val) => {
                    setFilterConditionId(val)
                    setBalancesPage(1)
                  }}
                  popupMatchSelectWidth={false}
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 280, whiteSpace: 'nowrap' }}
                  options={conditions.map((c) => ({
                    value: c.id,
                    label: `${c.name} ${c.is_sellable ? '(Sellable)' : '(Non-Sellable)'}`,
                  }))}
                />

                {isBalancesFiltered && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={handleClearBalancesFilters}
                    style={{ padding: 0 }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Space>

              <Tag color="default" style={{ fontSize: '12px', padding: '2px 8px' }}>
                Showing {balances.length} of {balancesTotal} stock records
              </Tag>
            </div>
          </Card>

          {/* All Balances Table */}
          <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: 0 }}>
            <Table
              rowKey="id"
              columns={allInventoryColumns}
              dataSource={balances}
              loading={balancesLoading}
              pagination={{
                current: balancesPage,
                pageSize: balancesPageSize,
                total: balancesTotal,
                showSizeChanger: true,
                pageSizeOptions: ['20', '25', '50', '100'],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
                onChange: (p, ps) => {
                  setBalancesPage(p)
                  setBalancesPageSize(ps)
                },
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No stock records match the selected filters."
                    style={{ padding: '36px 0' }}
                  >
                    {isBalancesFiltered && (
                      <Button type="primary" onClick={handleClearBalancesFilters}>
                        Clear Filters
                      </Button>
                    )}
                  </Empty>
                ),
              }}
            />
          </Card>
        </div>
      ) : (
        <div>
          {/* ROW 2: Empty state OR Selected Product Summary */}
          {!selectedProductId ? (
            <Card
              style={{
                borderRadius: 8,
                border: '1px dashed #cbd5e1',
                background: '#ffffff',
                textAlign: 'center',
                padding: '50px 24px',
                marginTop: 16,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <SearchOutlined style={{ fontSize: 28, color: '#2563eb' }} />
              </div>
              <Title level={4} style={{ color: '#0f172a', marginBottom: 6, fontWeight: 700 }}>
                Search and select a product to view its stock across locations
              </Title>
              <Text type="secondary" style={{ fontSize: 14, maxWidth: 520, display: 'inline-block' }}>
                Choose a product above to inspect exact physical counts, available sellable inventory, and locations holding units across all godowns and showrooms.
              </Text>

              {productOptions.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      marginBottom: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    Quick select a stocked product:
                  </div>
                  <Space wrap size={8} style={{ justifyContent: 'center' }}>
                    {productOptions.slice(0, 6).map((opt) => (
                      <Button
                        key={opt.value}
                        size="middle"
                        style={{ borderRadius: 16, fontSize: 13 }}
                        onClick={() => {
                          setSelectedProductId(opt.value)
                          setProductSearchText('')
                          setSearchParams({ tab: 'product', product_id: opt.value })
                        }}
                      >
                        {opt.name}{' '}
                        {opt.stock > 0 && (
                          <span style={{ color: '#16a34a', fontWeight: 600, marginLeft: 4 }}>
                            ({opt.stock} in store)
                          </span>
                        )}
                      </Button>
                    ))}
                  </Space>
                </div>
              )}
            </Card>
          ) : (
            <>
              {/* ROW 2: Selected Product Summary (Horizontal Card) */}
              <Card
                style={{
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
                bodyStyle={{ padding: '14px 20px' }}
              >
                <Row gutter={[20, 16]} align="middle">
                  {/* Left: Thumbnail + Title + SKU */}
                  <Col xs={24} md={10} lg={9}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={mappingData?.product.name || ''}
                          style={{
                            width: 80,
                            height: 64,
                            borderRadius: 8,
                            objectFit: 'cover',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 80,
                            height: 64,
                            borderRadius: 8,
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 26,
                          }}
                        >
                          🛋️
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '15.5px',
                            fontWeight: 700,
                            color: '#0f172a',
                            lineHeight: 1.3,
                            marginBottom: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={mappingData?.product.name}
                        >
                          {mappingData?.product.name}
                        </div>
                        {primarySku && (
                          <Tag
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              margin: 0,
                            }}
                          >
                            SKU: {primarySku}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </Col>

                  {/* Right: 4 Compact Enclosed KPI Cards */}
                  <Col xs={24} md={14} lg={15}>
                    <Row gutter={[10, 10]}>
                      <Col span={6}>
                        <ThinStatCard
                          label="Total Units"
                          value={totalStock}
                          accentColor="#2563eb"
                        />
                      </Col>

                      <Col span={6}>
                        <ThinStatCard
                          label="Available to Sell"
                          value={availableToSell}
                          accentColor="#16a34a"
                        />
                      </Col>

                      <Col span={6}>
                        <ThinStatCard
                          label="Non-Sellable"
                          value={nonSellable}
                          accentColor="#ea580c"
                        />
                      </Col>

                      <Col span={6}>
                        <ThinStatCard
                          label="Locations"
                          value={uniqueLocationsCount}
                          accentColor="#7c3aed"
                        />
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Card>

              {/* ROW 3: Brand & Category + Grid Filters Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                {/* Left: Brand & Category Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {brandName && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Brand:</span>
                      <Tag
                        color="purple"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 10px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        {brandName}
                      </Tag>
                    </div>
                  )}

                  {categoryName && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Category:</span>
                      <Tag
                        color="blue"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 10px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        {categoryName}
                      </Tag>
                    </div>
                  )}
                </div>

                {/* Right: Location & Condition Filters, Refresh, Allocate Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Select
                    value={locFilter}
                    onChange={setLocFilter}
                    style={{ width: 170 }}
                    options={[{ value: 'all', label: 'All Locations' }, ...uniqueLocationOptions]}
                  />

                  <Select
                    value={condFilter}
                    onChange={setCondFilter}
                    style={{ width: 160 }}
                    popupMatchSelectWidth={false}
                    dropdownMatchSelectWidth={false}
                    dropdownStyle={{ minWidth: 280, whiteSpace: 'nowrap' }}
                    options={[
                      { value: 'all', label: 'All Conditions' },
                      ...uniqueConditionOptions,
                    ]}
                  />

                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => selectedProductId && loadProductMapping(selectedProductId)}
                    title="Refresh stock across locations"
                  />

                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenAllocateModal()}
                  >
                    Allocate to Location
                  </Button>
                </div>
              </div>

              {/* Table */}
              <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }} bodyStyle={{ padding: 0 }}>
                <Table
                  rowKey={(r) => `${r.location_id}-${r.variant_id}-${r.condition_id}`}
                  columns={productLocationColumns}
                  dataSource={filteredLocationsList}
                  loading={loadingMapping}
                  pagination={{
                    pageSize: 10,
                    hideOnSinglePage: true,
                    showSizeChanger: false,
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description={
                          <div style={{ padding: '24px 0' }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                              No stock records found for this product.
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                              This item is currently not stored in any showroom, godown, or room.
                            </div>
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => handleOpenAllocateModal()}
                            >
                              Allocate Stock to Location
                            </Button>
                          </div>
                        }
                      />
                    ),
                  }}
                />
                {filteredLocationsList.length > 0 && (
                  <div
                    style={{
                      padding: '12px 20px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fafafa',
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      Showing {filteredLocationsList.length} stock{' '}
                      {filteredLocationsList.length === 1 ? 'record' : 'records'} across{' '}
                      {new Set(filteredLocationsList.map((r) => r.location_id)).size}{' '}
                      {new Set(filteredLocationsList.map((r) => r.location_id)).size === 1
                        ? 'location'
                        : 'locations'}
                    </Text>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Allocate / Add Units (Tab 2)                     */}
      {/* ========================================================= */}
      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: '#0284c7' }} />
            <span>Allocate Stock to Location</span>
          </Space>
        }
        open={allocateModalOpen}
        onOk={handleSaveAllocation}
        onCancel={() => setAllocateModalOpen(false)}
        confirmLoading={allocateLoading}
        okText={hasExistingAllocateStock ? 'Add Stock' : 'Set Stock'}
        destroyOnClose
        width={620}
      >
        <Form form={allocateForm} layout="vertical" style={{ marginTop: 12 }}>
          {mappingData?.product && (
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, marginBottom: 14 }}>
              <Text strong style={{ color: '#0f172a' }}>{mappingData.product.name}</Text>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Allocate stock units directly into a showroom, godown, or shelf.
              </div>
            </div>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="variant_id"
                label="Product Variant"
                rules={[{ required: true, message: 'Please select variant' }]}
              >
                <Select
                  options={mappingData?.product.variants.map((v) => ({
                    value: v.id,
                    label: `${v.variant_name || 'Default'} (${v.sku})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="condition_id"
                label="Stock Condition"
                rules={[{ required: true, message: 'Please select condition' }]}
              >
                <Select
                  placeholder="Select stock condition"
                  popupMatchSelectWidth={false}
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 280, whiteSpace: 'nowrap' }}
                  options={conditions.map((c) => ({
                    value: c.id,
                    label: c.name + (c.is_sellable ? ' (Sellable)' : ' (Non-Sellable)'),
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={24}>
              <Form.Item
                name="location_id"
                label="Storage Location"
                rules={[{ required: true, message: 'Please select location' }]}
              >
                <TreeSelect
                  showSearch
                  placeholder="Select godown / room / floor..."
                  treeData={locationTree}
                  treeDefaultExpandAll
                  popupMatchSelectWidth={false}
                  dropdownMatchSelectWidth={false}
                  dropdownStyle={{
                    minWidth: 440,
                    maxWidth: 620,
                    maxHeight: 420,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                  treeNodeFilterProp="titleText"
                  filterTreeNode={(search, item: any) =>
                    (item?.titleText || '').toLowerCase().includes(search.toLowerCase().trim())
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Dynamic Smart Status Badge */}
          {watchedAllocateLocationId ? (
            hasExistingAllocateStock ? (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Tag color="success" style={{ fontWeight: 600, margin: 0, padding: '2px 8px' }}>
                      Add to Existing Stock
                    </Tag>
                    <Text strong style={{ color: '#166534', fontSize: 13 }}>
                      Current Stock: {existingAllocateStockQty} units
                    </Text>
                  </div>
                  <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                    Stock already exists at this location. Units entered below will be added to the current {existingAllocateStockQty} units.
                  </div>
                </div>
                {Number(watchedAllocateQuantity || 0) > 0 && (
                  <div
                    style={{
                      textAlign: 'right',
                      background: '#dcfce7',
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #86efac',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>
                      New Total
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#14532d' }}>
                      {existingAllocateStockQty + Number(watchedAllocateQuantity || 0)} units
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Tag color="processing" style={{ fontWeight: 600, margin: 0, padding: '2px 8px' }}>
                      Set Initial Stock
                    </Tag>
                    <Text strong style={{ color: '#0369a1', fontSize: 13 }}>
                      Current Stock: 0 units
                    </Text>
                  </div>
                  <div style={{ fontSize: 12, color: '#0284c7', marginTop: 4 }}>
                    No stock exists at this location yet. Units entered below will establish the starting physical inventory.
                  </div>
                </div>
                {Number(watchedAllocateQuantity || 0) > 0 && (
                  <div
                    style={{
                      textAlign: 'right',
                      background: '#e0f2fe',
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #7dd3fc',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#0369a1', textTransform: 'uppercase', fontWeight: 600 }}>
                      Initial Total
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0c4a6e' }}>
                      {Number(watchedAllocateQuantity || 0)} units
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                color: '#64748b',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>ℹ️ Select a storage location above to check existing stock and operation mode.</span>
            </div>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label={hasExistingAllocateStock ? 'Quantity to Add (Units)' : 'Initial Quantity (Units)'}
                rules={[{ required: true, message: 'Enter quantity' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Notes / Reference">
                <Input placeholder="e.g. Intake, showroom setup, carton count" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: Inter-Location Transfer (Unified)                */}
      {/* ========================================================= */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#2563eb' }} />
            <span>Inter-Location Stock Transfer</span>
          </Space>
        }
        open={transferModalOpen}
        onOk={handleSaveTransfer}
        onCancel={() => {
          setTransferModalOpen(false)
          setSelectedItemForTransfer(null)
        }}
        confirmLoading={transferLoading}
        okText="Dispatch Transfer"
        destroyOnClose
        width={620}
      >
        {selectedItemForTransfer && (
          <Form form={transferForm} layout="vertical" style={{ marginTop: 12 }}>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 6, marginBottom: 16 }}>
              {selectedItemForTransfer.product_name && (
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                  {selectedItemForTransfer.product_name}
                  {selectedItemForTransfer.sku && (
                    <Tag color="blue" style={{ marginLeft: 8, fontFamily: 'monospace' }}>
                      {selectedItemForTransfer.sku}
                    </Tag>
                  )}
                </div>
              )}
              <Row gutter={12}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>FROM (Source):</Text>
                  <Text strong>{cleanLocationName(selectedItemForTransfer.location_name)}</Text>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Condition: {selectedItemForTransfer.condition_name}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Available Units:</Text>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a' }}>
                    {selectedItemForTransfer.quantity} units
                  </span>
                </Col>
              </Row>
            </div>

            <Form.Item
              name="destination_location_id"
              label="TO (Destination Store / Room / Godown)"
              rules={[{ required: true, message: 'Please select destination location' }]}
            >
              <TreeSelect
                showSearch
                placeholder="Select destination showroom or godown..."
                treeData={locationTree}
                treeDefaultExpandAll
                popupMatchSelectWidth={false}
                dropdownMatchSelectWidth={false}
                dropdownStyle={{
                  minWidth: 440,
                  maxWidth: 620,
                  maxHeight: 420,
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                }}
                treeNodeFilterProp="titleText"
                filterTreeNode={(search, item: any) =>
                  (item?.titleText || '').toLowerCase().includes(search.toLowerCase().trim())
                }
              />
            </Form.Item>

            <Form.Item
              name="quantity"
              label="Transfer Quantity"
              rules={[
                { required: true, message: 'Please enter transfer quantity' },
                {
                  validator: async (_, val) => {
                    if (val > selectedItemForTransfer.quantity) {
                      return Promise.reject(
                        new Error(`Cannot transfer more than ${selectedItemForTransfer.quantity} available units`)
                      )
                    }
                    if (val <= 0) {
                      return Promise.reject(new Error('Quantity must be at least 1'))
                    }
                  },
                },
              ]}
            >
              <InputNumber min={1} max={selectedItemForTransfer.quantity} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="notes" label="Dispatch Notes / Challan #">
              <Input.TextArea rows={2} placeholder="e.g. Sent via internal van to Ground Floor Showroom" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: Reclassify Stock Condition (Unified)             */}
      {/* ========================================================= */}
      <Modal
        title={
          <Space>
            <SyncOutlined style={{ color: '#7c3aed' }} />
            <span>Reclassify Stock Condition</span>
          </Space>
        }
        open={conditionModalOpen}
        onOk={handleSaveCondition}
        onCancel={() => {
          setConditionModalOpen(false)
          setSelectedItemForCondition(null)
        }}
        confirmLoading={conditionLoading}
        okText="Update Condition"
        destroyOnClose
        width={540}
      >
        {selectedItemForCondition && (
          <Form form={conditionForm} layout="vertical" style={{ marginTop: 12 }}>
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 6, marginBottom: 16 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                {selectedItemForCondition.product_name || mappingData?.product.name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
                Location: <strong>{cleanLocationName(selectedItemForCondition.location_name)}</strong> | Current:{' '}
                <Tag color="blue" style={{ marginLeft: 4 }}>
                  {selectedItemForCondition.condition_name}
                </Tag>
                ({selectedItemForCondition.quantity} units)
              </div>
            </div>

            <Form.Item
              name="to_condition_id"
              label="New Stock Condition"
              rules={[{ required: true, message: 'Please select target condition' }]}
            >
              <Select
                placeholder="Choose new condition (e.g. Display Sample, Damaged, Sellable)"
                popupMatchSelectWidth={false}
                dropdownMatchSelectWidth={false}
                dropdownStyle={{ minWidth: 320, whiteSpace: 'nowrap' }}
                options={conditions
                  .filter((c) => c.id !== selectedItemForCondition.condition_id)
                  .map((c) => ({
                    value: c.id,
                    label: c.name + (c.is_sellable ? ' (Sellable)' : ' (Non-Sellable)'),
                  }))}
              />
            </Form.Item>

            <Form.Item
              name="quantity"
              label="Units to Reclassify"
              rules={[
                { required: true, message: 'Enter quantity' },
                {
                  validator: async (_, val) => {
                    if (val > selectedItemForCondition.quantity) {
                      return Promise.reject(
                        new Error(`Cannot reclassify more than ${selectedItemForCondition.quantity} units`)
                      )
                    }
                    if (val <= 0) {
                      return Promise.reject(new Error('Quantity must be at least 1'))
                    }
                  },
                },
              ]}
            >
              <InputNumber min={1} max={selectedItemForCondition.quantity} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="notes" label="Reason for Reclassification">
              <Input.TextArea rows={2} placeholder="e.g. Put on floor for customer demo, minor transit scratch" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: Physical Stock Adjustment (Unified)              */}
      {/* ========================================================= */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#d97706' }} />
            <span>Stock Adjustment (Audit Correction)</span>
          </Space>
        }
        open={adjustModalOpen}
        onOk={handleSaveAdjust}
        onCancel={() => {
          setAdjustModalOpen(false)
          setSelectedItemForAdjust(null)
        }}
        confirmLoading={adjustLoading}
        okText="Apply Adjustment"
        destroyOnClose
        width={620}
      >
        {selectedItemForAdjust && (
          <Form form={adjustForm} layout="vertical" style={{ marginTop: 12 }}>
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '12px 14px',
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#92400e' }}>
                <ExclamationCircleOutlined /> Physical Inventory Audit
              </div>
              <div style={{ fontSize: '12px', color: '#78350f', marginTop: 4 }}>
                {selectedItemForAdjust.product_name && (
                  <div>Product: <strong>{selectedItemForAdjust.product_name}</strong></div>
                )}
                Location: <strong>{cleanLocationName(selectedItemForAdjust.location_name)}</strong> | Current System Count:{' '}
                <strong>{selectedItemForAdjust.quantity} units</strong>
              </div>
            </div>

            <Form.Item name="adjust_type" label="Adjustment Mode">
              <Radio.Group>
                <Radio value="set_actual">Set Actual Counted Total</Radio>
                <Radio value="delta">Adjust by +/- Delta</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.adjust_type !== cur.adjust_type}>
              {({ getFieldValue }) =>
                getFieldValue('adjust_type') === 'set_actual' ? (
                  <Form.Item
                    name="actual_quantity"
                    label="Actual Physical Count"
                    rules={[{ required: true, message: 'Enter actual count' }]}
                    extra={`System currently has ${selectedItemForAdjust.quantity} units. Difference will be logged automatically.`}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="delta_quantity"
                    label="Adjustment Delta (+ / -)"
                    rules={[{ required: true, message: 'Enter adjustment amount' }]}
                    extra="Positive to add found units (+), negative to write-off missing/damaged (-)"
                  >
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                )
              }
            </Form.Item>

            <Form.Item
              name="reason_code"
              label="Adjustment Reason Code"
              rules={[{ required: true, message: 'Select reason' }]}
            >
              <Select
                placeholder="Select adjustment reason"
                popupMatchSelectWidth={false}
                dropdownMatchSelectWidth={false}
                dropdownStyle={{ minWidth: 320, whiteSpace: 'nowrap' }}
                options={adjustmentReasonOptions.length > 0 ? adjustmentReasonOptions : [
                  { label: 'Physical Stock Count / Audit', value: 'PHYSICAL_COUNT' },
                  { label: 'Damage / Broken Goods Write-off', value: 'DAMAGE' },
                  { label: 'Theft / Shrinkage Loss', value: 'THEFT_LOSS' },
                  { label: 'Found Unrecorded Stock', value: 'FOUND_STOCK' },
                  { label: 'Damaged in Store / Display', value: 'DAMAGED_IN_STORE' },
                  { label: 'Clerical Correction', value: 'CLERICAL_ERROR' },
                  { label: 'Display Sample Conversion', value: 'SAMPLE' },
                  { label: 'Other Operational Adjustment', value: 'OTHER' },
                ]}
              />
            </Form.Item>

            <Form.Item name="notes" label="Audit Notes / Explanation">
              <Input.TextArea rows={2} placeholder="Explain why physical count differs from system count" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default StockMaintenancePage
