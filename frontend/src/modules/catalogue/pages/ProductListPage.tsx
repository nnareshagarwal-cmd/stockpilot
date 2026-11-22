import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Card,
  Popconfirm,
  message,
  Row,
  Col,
  AutoComplete,
} from 'antd'
import { ThinStatCard } from '../../../components/common/ThinStatCard'
import {
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { PaginatedResponse, ProductSearchItem, ApiResponse } from '../../../api/types'

const { Title, Text } = Typography

const FILTER_STORAGE_KEY = 'stockpilot_product_filters'

interface ProductFilters {
  page: number
  pageSize: number
  search: string
  categoryId?: string
  subcategoryId?: string
  brandId?: string
  stockStatus?: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock'
}

function getStoredFilters(): Partial<ProductFilters> | null {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    // Ignore parse errors
  }
  return null
}

function saveStoredFilters(filters: ProductFilters) {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch (e) {
    // Ignore storage errors
  }
}

function clearStoredFilters() {
  try {
    sessionStorage.removeItem(FILTER_STORAGE_KEY)
  } catch (e) {
    // Ignore storage errors
  }
}

export const ProductListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Determine initial filter values: URL search params first, then sessionStorage backup
  const initialFilters = useMemo<ProductFilters>(() => {
    // Check if explicitly requested to clear filters (e.g. from Dashboard "Total Products")
    if (searchParams.get('clear') === 'true') {
      clearStoredFilters()
      return {
        page: 1,
        pageSize: 20,
        search: '',
        categoryId: undefined,
        subcategoryId: undefined,
        brandId: undefined,
        stockStatus: 'all',
      }
    }

    const rawStockStatus = searchParams.get('stock_status')
    const validStockStatus =
      rawStockStatus === 'in_stock' || rawStockStatus === 'out_of_stock' || rawStockStatus === 'low_stock'
        ? rawStockStatus
        : 'all'

    const hasUrlParams =
      searchParams.has('page') ||
      searchParams.has('page_size') ||
      searchParams.has('search') ||
      searchParams.has('category_id') ||
      searchParams.has('subcategory_id') ||
      searchParams.has('brand_id') ||
      searchParams.has('stock_status')

    if (hasUrlParams) {
      const filters: ProductFilters = {
        page: parseInt(searchParams.get('page') || '1', 10) || 1,
        pageSize: parseInt(searchParams.get('page_size') || '20', 10) || 20,
        search: searchParams.get('search') || '',
        categoryId: searchParams.get('category_id') || undefined,
        subcategoryId: searchParams.get('subcategory_id') || undefined,
        brandId: searchParams.get('brand_id') || undefined,
        stockStatus: validStockStatus,
      }
      saveStoredFilters(filters)
      return filters
    }

    const stored = getStoredFilters()
    if (
      stored &&
      (stored.categoryId ||
        stored.subcategoryId ||
        stored.brandId ||
        stored.search ||
        (stored.stockStatus && stored.stockStatus !== 'all') ||
        (stored.page && stored.page > 1))
    ) {
      return {
        page: stored.page || 1,
        pageSize: stored.pageSize || 20,
        search: stored.search || '',
        categoryId: stored.categoryId,
        subcategoryId: stored.subcategoryId,
        brandId: stored.brandId,
        stockStatus: stored.stockStatus || 'all',
      }
    }

    return {
      page: 1,
      pageSize: 20,
      search: '',
      categoryId: undefined,
      subcategoryId: undefined,
      brandId: undefined,
      stockStatus: 'all',
    }
  }, [])

  const [page, setPage] = useState<number>(initialFilters.page)
  const [pageSize, setPageSize] = useState<number>(initialFilters.pageSize)
  const [searchInput, setSearchInput] = useState<string>(initialFilters.search)
  const [search, setSearch] = useState<string>(initialFilters.search)
  const [mainCategoryId, setMainCategoryId] = useState<string | undefined>(initialFilters.categoryId)
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(initialFilters.subcategoryId)
  const [brandId, setBrandId] = useState<string | undefined>(initialFilters.brandId)
  const [stockStatus, setStockStatus] = useState<'all' | 'in_stock' | 'out_of_stock' | 'low_stock'>(
    initialFilters.stockStatus || 'all'
  )
  const [exporting, setExporting] = useState(false)

  // If initial filters were restored from sessionStorage and not in URL, sync them to URL
  useEffect(() => {
    if (searchParams.get('clear') === 'true') {
      return
    }

    const hasUrlParams =
      searchParams.has('page') ||
      searchParams.has('search') ||
      searchParams.has('category_id') ||
      searchParams.has('subcategory_id') ||
      searchParams.has('brand_id') ||
      searchParams.has('stock_status')

    if (
      !hasUrlParams &&
      (initialFilters.categoryId ||
        initialFilters.subcategoryId ||
        initialFilters.brandId ||
        initialFilters.search ||
        (initialFilters.stockStatus && initialFilters.stockStatus !== 'all') ||
        initialFilters.page > 1)
    ) {
      const params: Record<string, string> = {}
      if (initialFilters.page > 1) params.page = initialFilters.page.toString()
      if (initialFilters.pageSize !== 20) params.page_size = initialFilters.pageSize.toString()
      if (initialFilters.search) params.search = initialFilters.search
      if (initialFilters.categoryId) params.category_id = initialFilters.categoryId
      if (initialFilters.subcategoryId) params.subcategory_id = initialFilters.subcategoryId
      if (initialFilters.brandId) params.brand_id = initialFilters.brandId
      if (initialFilters.stockStatus && initialFilters.stockStatus !== 'all') {
        params.stock_status = initialFilters.stockStatus
      }
      setSearchParams(params, { replace: true })
    }
  }, [])

  // Sync state if URL searchParams change (e.g. browser back/forward or navigation from Dashboard)
  useEffect(() => {
    if (searchParams.get('clear') === 'true') {
      clearStoredFilters()
      setPage(1)
      setPageSize(20)
      setSearch('')
      setSearchInput('')
      setMainCategoryId(undefined)
      setSubcategoryId(undefined)
      setBrandId(undefined)
      setStockStatus('all')
      setSearchParams({}, { replace: true })
      return
    }

    const p = parseInt(searchParams.get('page') || '1', 10) || 1
    const ps = parseInt(searchParams.get('page_size') || '20', 10) || 20
    const s = searchParams.get('search') || ''
    const cat = searchParams.get('category_id') || undefined
    const sub = searchParams.get('subcategory_id') || undefined
    const br = searchParams.get('brand_id') || undefined
    const rawSt = searchParams.get('stock_status')
    const st: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock' =
      rawSt === 'in_stock' || rawSt === 'out_of_stock' || rawSt === 'low_stock' ? rawSt : 'all'

    setPage(p)
    setPageSize(ps)
    setSearch(s)
    setSearchInput(s)
    setMainCategoryId(cat)
    setSubcategoryId(sub)
    setBrandId(br)
    setStockStatus(st)

    if (cat || sub || br || s || st !== 'all' || p > 1) {
      saveStoredFilters({
        page: p,
        pageSize: ps,
        search: s,
        categoryId: cat,
        subcategoryId: sub,
        brandId: br,
        stockStatus: st,
      })
    }
  }, [searchParams])

  // Helper to update state, URL searchParams, and sessionStorage
  const updateFilters = (updates: {
    page?: number
    pageSize?: number
    search?: string
    category_id?: string | null | undefined
    subcategory_id?: string | null | undefined
    brand_id?: string | null | undefined
    stock_status?: 'all' | 'in_stock' | 'out_of_stock' | 'low_stock' | null | undefined
  }) => {
    const newPage = 'page' in updates && updates.page !== undefined ? updates.page : page
    const newPageSize =
      'pageSize' in updates && updates.pageSize !== undefined ? updates.pageSize : pageSize
    const newSearch = 'search' in updates && updates.search !== undefined ? updates.search : search
    const newCatId = 'category_id' in updates ? updates.category_id || undefined : mainCategoryId
    const newSubcatId =
      'subcategory_id' in updates ? updates.subcategory_id || undefined : subcategoryId
    const newBrandId = 'brand_id' in updates ? updates.brand_id || undefined : brandId
    const newStockStatus =
      'stock_status' in updates ? updates.stock_status || 'all' : stockStatus

    setPage(newPage)
    setPageSize(newPageSize)
    setSearch(newSearch)
    setSearchInput(newSearch)
    setMainCategoryId(newCatId)
    setSubcategoryId(newSubcatId)
    setBrandId(newBrandId)
    setStockStatus(newStockStatus)

    const params: Record<string, string> = {}
    if (newPage > 1) params.page = newPage.toString()
    if (newPageSize !== 20) params.page_size = newPageSize.toString()
    if (newSearch) params.search = newSearch
    if (newCatId) params.category_id = newCatId
    if (newSubcatId) params.subcategory_id = newSubcatId
    if (newBrandId) params.brand_id = newBrandId
    if (newStockStatus && newStockStatus !== 'all') params.stock_status = newStockStatus

    setSearchParams(params, { replace: true })

    if (newCatId || newSubcatId || newBrandId || newSearch || (newStockStatus && newStockStatus !== 'all') || newPage > 1) {
      saveStoredFilters({
        page: newPage,
        pageSize: newPageSize,
        search: newSearch,
        categoryId: newCatId,
        subcategoryId: newSubcatId,
        brandId: newBrandId,
        stockStatus: newStockStatus,
      })
    } else {
      clearStoredFilters()
    }
  }

  // Debounce search input to filter table smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateFilters({ search: searchInput, page: 1 })
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch categories & brands for dropdown filters
  const { data: categories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/categories')
      return res.data.data
    },
  })

  const { data: brands } = useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/brands')
      return res.data.data
    },
  })

  // Separate categories into Main Categories (parent_id IS NULL) and Subcategories
  const mainCategories = useMemo(() => {
    return categories?.filter((c: any) => !c.parent_id && c.is_active !== false) || []
  }, [categories])

  const subCategories = useMemo(() => {
    if (!mainCategoryId) {
      return categories?.filter((c: any) => c.parent_id && c.is_active !== false) || []
    }
    return categories?.filter((c: any) => c.parent_id === mainCategoryId && c.is_active !== false) || []
  }, [categories, mainCategoryId])

  // Fetch paginated products
  const { data: productData, isLoading } = useQuery({
    queryKey: ['products', page, pageSize, search, mainCategoryId, subcategoryId, brandId, stockStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        is_active: 'true',
      })
      if (search) params.append('search', search)
      if (mainCategoryId) params.append('category_id', mainCategoryId)
      if (subcategoryId) params.append('subcategory_id', subcategoryId)
      if (brandId) params.append('brand_id', brandId)
      if (stockStatus === 'in_stock') {
        params.append('in_stock', 'true')
      } else if (stockStatus === 'out_of_stock') {
        params.append('in_stock', 'false')
      } else if (stockStatus === 'low_stock') {
        params.append('low_stock', 'true')
      }

      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>(`/products?${params.toString()}`)
      return res.data
    },
  })

  // Typeahead suggestions based on loaded products
  const searchSuggestions = useMemo(() => {
    if (!searchInput || !searchInput.trim()) return []
    const term = searchInput.toLowerCase().trim()
    const items = productData?.data || []
    const matches = items.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.default_sku && p.default_sku.toLowerCase().includes(term)) ||
        (p.model && p.model.toLowerCase().includes(term))
    )

    return matches.slice(0, 8).map((p) => ({
      value: p.name,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '2px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
              {p.name}
            </div>
            {(p.default_sku || p.model) && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {p.default_sku && <span>SKU: <strong style={{ color: '#2563eb' }}>{p.default_sku}</strong></span>}
                {p.default_sku && p.model ? ' • ' : ''}
                {p.model && <span>Model: {p.model}</span>}
              </div>
            )}
          </div>
          {p.category && (
            <Tag color="blue" style={{ fontSize: '11px', margin: 0, flexShrink: 0, alignSelf: 'center' }}>
              {p.category}
            </Tag>
          )}
        </div>
      ),
    }))
  }, [searchInput, productData])

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.delete(`/products/${productId}`)
    },
    onSuccess: () => {
      message.success('Product archived successfully')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: () => {
      message.error('Failed to archive product')
    },
  })

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (mainCategoryId) params.append('category_id', mainCategoryId)
      if (subcategoryId) params.append('subcategory_id', subcategoryId)
      if (brandId) params.append('brand_id', brandId)

      const res = await apiClient.get(`/products/export?${params.toString()}`, {
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `products_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('Products exported successfully')
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Failed to export products')
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      title: 'Image',
      dataIndex: 'primary_image_url',
      key: 'image',
      width: 70,
      render: (url: string) =>
        url ? (
          <img
            src={url}
            alt="product"
            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              background: '#f1f5f9',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
            }}
          >
            <AppstoreOutlined />
          </div>
        ),
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ProductSearchItem) => (
        <div>
          <Text
            strong
            style={{ cursor: 'pointer', color: '#1677ff' }}
            onClick={() =>
              navigate(`/products/${record.id}`, {
                state: { returnSearch: searchParams.toString() },
              })
            }
          >
            {name}
          </Text>
          {record.model && (
            <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>
              Model: {record.model}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      render: (_: any, record: ProductSearchItem) => (
        <div>
          <Text strong>{record.category || '—'}</Text>
          {record.subcategory && (
            <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
              {record.subcategory}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Brand',
      dataIndex: 'brand',
      key: 'brand',
      render: (brand: string) => brand || <Text type="secondary">—</Text>,
    },
    {
      title: 'Cost Price',
      key: 'cost_price',
      align: 'right' as const,
      width: 120,
      render: (_: any, record: ProductSearchItem) => {
        const val = record.cost_price ?? record.purchase_price
        return val !== undefined && val !== null ? (
          <Text style={{ color: '#475569', fontWeight: 500 }}>
            ₹{Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        )
      },
    },
    {
      title: 'MRP',
      dataIndex: 'mrp',
      key: 'mrp',
      align: 'right' as const,
      width: 110,
      render: (mrp: number) =>
        mrp !== undefined && mrp !== null ? (
          <Text strong style={{ color: '#0f172a' }}>
            ₹{Number(mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      align: 'right' as const,
      width: 125,
      render: (price: number) =>
        price !== undefined && price !== null ? (
          <Text strong style={{ color: '#1677ff' }}>
            ₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Stock',
      dataIndex: 'total_stock',
      key: 'total_stock',
      align: 'right' as const,
      width: 120,
      render: (stock: number) => {
        const qty = Number(stock || 0)
        return (
          <Tag color={qty > 0 ? 'green' : 'default'} style={{ fontWeight: 600 }}>
            {qty > 0 ? `${qty.toLocaleString()} units` : 'Out of stock'}
          </Tag>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_: any, record: ProductSearchItem) => (
        <Space size={8}>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() =>
              navigate(`/products/${record.id}`, {
                state: { returnSearch: searchParams.toString() },
              })
            }
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() =>
              navigate(`/products/${record.id}/edit`, {
                state: { returnSearch: searchParams.toString() },
              })
            }
          />
          {record.is_active && (
            <Popconfirm
              title="Archive product?"
              description="This will soft-delete the product from active search."
              onConfirm={() => archiveMutation.mutate(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Products
          </Title>
          <Text type="secondary">Manage your master product catalogue, variants, and pricing</Text>
        </div>
        <Space size={12}>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            Export CSV
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => navigate('/products/import')}>
            Import CSV
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              navigate('/products/new', {
                state: { returnSearch: searchParams.toString() },
              })
            }
          >
            Add Product
          </Button>
        </Space>
      </div>

      {/* Metric Cards Strip - 3 Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={8}>
          <ThinStatCard
            label={
              stockStatus === 'in_stock'
                ? 'Stocked Products'
                : stockStatus === 'out_of_stock'
                ? 'Out of Stock Products'
                : stockStatus === 'low_stock'
                ? 'Low Stock Products'
                : 'Total Products'
            }
            value={productData?.pagination?.total_items || 0}
            accentColor={
              stockStatus === 'in_stock'
                ? '#16a34a'
                : stockStatus === 'out_of_stock'
                ? '#dc2626'
                : stockStatus === 'low_stock'
                ? '#f59e0b'
                : '#2563eb'
            }
          />
        </Col>
        <Col xs={24} sm={8}>
          <ThinStatCard
            label="Active Categories"
            value={categories?.length || 0}
            accentColor="#10b981"
          />
        </Col>
        <Col xs={24} sm={8}>
          <ThinStatCard
            label="Active Brands"
            value={brands?.length || 0}
            accentColor="#8b5cf6"
          />
        </Col>
      </Row>

      {/* Filter Toolbar */}
      <Card
        style={{
          borderRadius: '10px',
          marginBottom: '14px',
          border: '1px solid #e2e8f0',
        }}
        bodyStyle={{ padding: '14px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <Space wrap size={12} align="center">
            {/* Typeahead Search for Products */}
            <AutoComplete
              options={searchSuggestions}
              value={searchInput}
              onChange={(val) => setSearchInput(val)}
              onSelect={(val: string) => {
                updateFilters({ search: val, page: 1 })
              }}
              style={{ width: 260 }}
              popupMatchSelectWidth={false}
              popupClassName="product-search-dropdown"
              dropdownStyle={{
                minWidth: 260,
                maxWidth: 'min(580px, 92vw)',
                width: 'max-content',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                borderRadius: 8,
              }}
            >
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Search product, SKU..."
                allowClear
                onPressEnter={() => {
                  updateFilters({ search: searchInput, page: 1 })
                }}
              />
            </AutoComplete>

            {/* Stock Status Filter */}
            <Select
              style={{ width: 180 }}
              value={stockStatus}
              onChange={(val) => {
                updateFilters({ stock_status: val, page: 1 })
              }}
              options={[
                { label: 'All Stock Statuses', value: 'all' },
                { label: 'In Stock (Stocked)', value: 'in_stock' },
                { label: 'Out of Stock (0 units)', value: 'out_of_stock' },
                { label: 'Low Stock (Replenish)', value: 'low_stock' },
              ]}
            />

            {/* Main Category */}
            <Select
              showSearch
              placeholder="All Main Categories"
              allowClear
              style={{ width: 190 }}
              value={mainCategoryId}
              onChange={(val) => {
                updateFilters({ category_id: val, subcategory_id: undefined, page: 1 })
              }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={mainCategories.map((c: any) => ({ label: c.name, value: c.id }))}
            />

            {/* Subcategory */}
            <Select
              showSearch
              placeholder={mainCategoryId ? 'All Subcategories' : 'Subcategory'}
              allowClear
              style={{ width: 190 }}
              value={subcategoryId}
              onChange={(val) => {
                updateFilters({ subcategory_id: val, page: 1 })
              }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={subCategories.map((sc: any) => ({ label: sc.name, value: sc.id }))}
            />

            {/* Brands with search / typeahead */}
            <Select
              showSearch
              placeholder="All Brands"
              allowClear
              style={{ width: 170 }}
              value={brandId}
              onChange={(val) => {
                updateFilters({ brand_id: val, page: 1 })
              }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={brands?.map((b: any) => ({ label: b.name, value: b.id })) || []}
            />

            {/* Reset Filters button if any filter active */}
            {(searchInput || mainCategoryId || subcategoryId || brandId || stockStatus !== 'all') && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  clearStoredFilters()
                  updateFilters({
                    search: '',
                    category_id: undefined,
                    subcategory_id: undefined,
                    brand_id: undefined,
                    stock_status: 'all',
                    page: 1,
                  })
                }}
                style={{ padding: 0 }}
              >
                Reset Filters
              </Button>
            )}
          </Space>

          {/* Showing Rows count near filter */}
          <div>
            <Tag
              color="blue"
              style={{
                fontSize: '13px',
                padding: '4px 12px',
                borderRadius: '6px',
                margin: 0,
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
              }}
            >
              Showing <strong>{productData?.data?.length || 0}</strong> of{' '}
              <strong>{productData?.pagination?.total_items || 0}</strong> products
            </Tag>
          </div>
        </div>
      </Card>

      {/* Product Table */}
      <Card
        style={{
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={productData?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: productData?.pagination?.total_items || 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              updateFilters({ page: p, pageSize: ps })
            },
          }}
        />
      </Card>
    </div>
  )
}
