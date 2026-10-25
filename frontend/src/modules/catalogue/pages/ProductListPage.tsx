import React, { useState, useEffect, useMemo } from 'react'
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
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { PaginatedResponse, ProductSearchItem, ApiResponse } from '../../../api/types'

const { Title, Text } = Typography

export const ProductListPage: React.FC = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [mainCategoryId, setMainCategoryId] = useState<string | undefined>(undefined)
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(undefined)
  const [brandId, setBrandId] = useState<string | undefined>(undefined)

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Debounce search input to filter table smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
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
    queryKey: ['products', page, pageSize, search, mainCategoryId, subcategoryId, brandId],
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

  const handleExport = () => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (mainCategoryId) params.append('category_id', mainCategoryId)
    if (subcategoryId) params.append('subcategory_id', subcategoryId)
    if (brandId) params.append('brand_id', brandId)
    window.open(`${apiClient.defaults.baseURL}/products/export?${params.toString()}`, '_blank')
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
          <Text strong style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => navigate(`/products/${record.id}`)}>
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
      title: 'Default SKU',
      dataIndex: 'default_sku',
      key: 'sku',
      render: (sku: string) => (sku ? <Tag color="blue">{sku}</Tag> : <Text type="secondary">—</Text>),
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
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      render: (price: number) =>
        price !== undefined ? (
          <Text strong>₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        ) : (
          '—'
        ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Active' : 'Archived'}</Tag>
      ),
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
            onClick={() => navigate(`/products/${record.id}`)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => navigate(`/products/${record.id}/edit`)}
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
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => navigate('/products/import')}>
            Import CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/new')}>
            Add Product
          </Button>
        </Space>
      </div>

      {/* Metric Cards Strip - 3 Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={8}>
          <ThinStatCard
            label="Total Products"
            value={productData?.pagination?.total_items || 0}
            accentColor="#2563eb"
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
                setSearchInput(val)
                setSearch(val)
                setPage(1)
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
                  setSearch(searchInput)
                  setPage(1)
                }}
              />
            </AutoComplete>

            {/* Main Category */}
            <Select
              showSearch
              placeholder="All Main Categories"
              allowClear
              style={{ width: 190 }}
              value={mainCategoryId}
              onChange={(val) => {
                setMainCategoryId(val)
                setSubcategoryId(undefined)
                setPage(1)
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
                setSubcategoryId(val)
                setPage(1)
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
                setBrandId(val)
                setPage(1)
              }}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={brands?.map((b: any) => ({ label: b.name, value: b.id })) || []}
            />

            {/* Reset Filters button if any filter active */}
            {(searchInput || mainCategoryId || subcategoryId || brandId) && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  setMainCategoryId(undefined)
                  setSubcategoryId(undefined)
                  setBrandId(undefined)
                  setPage(1)
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
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>
    </div>
  )
}
