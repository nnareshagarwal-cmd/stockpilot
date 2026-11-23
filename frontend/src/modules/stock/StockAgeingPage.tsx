import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Select,
  message,
} from 'antd'
import {
  SyncOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import { stockApi, AgeingSummary, AgeingItem } from '../../api/stock'
import apiClient from '../../api/client'
import { ThinStatCard } from '../../components/common/ThinStatCard'
import { ProductSearchSelector } from '../../components/common/ProductSearchSelector'

const { Title, Text } = Typography

export const StockAgeingPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [ageing, setAgeing] = useState<AgeingSummary | null>(null)

  // Filters state
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>()
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | undefined>()
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>()
  const [ageingBandFilter, setAgeingBandFilter] = useState<'fresh' | 'slow' | 'dead' | null>(null)
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // Masters
  const [categories, setCategories] = useState<Array<{ id: string; name: string; parent_id?: string | null }>>([])
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    // Load categories & brands for filter dropdowns
    Promise.all([
      apiClient.get('/categories').catch(() => ({ data: { data: [] } })),
      apiClient.get('/brands').catch(() => ({ data: { data: [] } })),
    ]).then(([catRes, brandRes]) => {
      setCategories(catRes.data.data || [])
      setBrands(brandRes.data.data || [])
    })
  }, [])

  const fetchAgeing = async () => {
    setLoading(true)
    try {
      const data = await stockApi.getAgeing({
        product_id: selectedProductId,
        category_id: selectedCategoryId || selectedSubcategoryId,
        brand_id: selectedBrandId,
        search: debouncedSearch.trim() || undefined,
      })
      setAgeing(data)
    } catch (e) {
      message.error('Failed to load ageing report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgeing()
  }, [selectedProductId, selectedCategoryId, selectedSubcategoryId, selectedBrandId, debouncedSearch])

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  // Parent categories vs Subcategories
  const parentCategories = useMemo(() => {
    return categories.filter((c) => !c.parent_id)
  }, [categories])

  const subcategories = useMemo(() => {
    if (selectedCategoryId) {
      return categories.filter((c) => c.parent_id === selectedCategoryId)
    }
    return categories.filter((c) => Boolean(c.parent_id))
  }, [categories, selectedCategoryId])

  // Filtered Items for Table & Dynamic Stat totals
  const filteredItems = useMemo(() => {
    if (!ageing?.items) return []
    let list = ageing.items

    if (ageingBandFilter === 'fresh') {
      list = list.filter((it) => Number(it.bands['0-30 days'] || 0) > 0)
    } else if (ageingBandFilter === 'slow') {
      list = list.filter((it) => Number(it.bands['91-180 days'] || 0) > 0)
    } else if (ageingBandFilter === 'dead') {
      list = list.filter((it) => Number(it.bands['180+ days'] || 0) > 0)
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      list = list.filter(
        (it) =>
          it.product_name?.toLowerCase().includes(q) ||
          it.sku?.toLowerCase().includes(q) ||
          it.brand_name?.toLowerCase().includes(q) ||
          it.category_name?.toLowerCase().includes(q)
      )
    }

    return list
  }, [ageing?.items, ageingBandFilter, searchText])

  // Metrics for Current Filter
  const stats = useMemo(() => {
    const rawItems = filteredItems
    const totalValuation = rawItems.reduce((acc, it) => acc + Number(it.total_valuation || 0), 0)
    const totalUnits = rawItems.reduce((acc, it) => acc + Number(it.total_quantity || 0), 0)

    const freshUnits = rawItems.reduce((acc, it) => acc + Number(it.bands['0-30 days'] || 0), 0)
    const slowUnits = rawItems.reduce((acc, it) => acc + Number(it.bands['91-180 days'] || 0), 0)
    const deadUnits = rawItems.reduce((acc, it) => acc + Number(it.bands['180+ days'] || 0), 0)

    return {
      totalValuation,
      totalUnits,
      freshUnits,
      slowUnits,
      deadUnits,
    }
  }, [filteredItems])

  const isFiltered = Boolean(selectedProductId || selectedCategoryId || selectedSubcategoryId || selectedBrandId || ageingBandFilter || searchText.trim())

  const handleClearFilters = () => {
    setSelectedProductId(undefined)
    setSelectedCategoryId(undefined)
    setSelectedSubcategoryId(undefined)
    setSelectedBrandId(undefined)
    setAgeingBandFilter(null)
    setSearchText('')
  }

  const columns = [
    {
      title: 'Product & SKU',
      key: 'product',
      render: (_: any, r: AgeingItem) => (
        <div>
          {r.product_id ? (
            <Link
              to={`/stock/maintenance?tab=product&product_id=${r.product_id}`}
              style={{ fontWeight: 600, color: '#2563eb', fontSize: '13.5px' }}
              title="Click to view locations & manage stock for this product"
            >
              {r.product_name}
            </Link>
          ) : (
            <Text strong style={{ fontSize: '13.5px' }}>{r.product_name}</Text>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
            <Tag style={{ fontSize: '10.5px', margin: 0, fontFamily: 'monospace' }}>SKU: {r.sku}</Tag>
            {r.brand_name && (
              <Tag color="purple" style={{ fontSize: '10.5px', margin: 0 }}>
                {r.brand_name}
              </Tag>
            )}
            {r.category_name && (
              <Tag color="blue" style={{ fontSize: '10.5px', margin: 0 }}>
                {r.category_name}
              </Tag>
            )}
            {r.subcategory_name && (
              <Tag color="cyan" style={{ fontSize: '10.5px', margin: 0 }}>
                {r.subcategory_name}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Total Qty',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      align: 'right' as const,
      width: 100,
      render: (q: number) => <Text strong>{Number(q).toLocaleString()} units</Text>,
    },
    {
      title: '0–30 Days (Fresh)',
      key: 'band_0_30',
      align: 'right' as const,
      width: 130,
      render: (_: any, r: AgeingItem) => (
        <span style={{ color: Number(r.bands['0-30 days']) > 0 ? '#16a34a' : '#9ca3af', fontWeight: Number(r.bands['0-30 days']) > 0 ? 600 : 400 }}>
          {Number(r.bands['0-30 days'] || 0)}
        </span>
      ),
    },
    {
      title: '31–60 Days',
      key: 'band_31_60',
      align: 'right' as const,
      width: 110,
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
      width: 110,
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
      width: 130,
      render: (_: any, r: AgeingItem) => (
        <span style={{ color: Number(r.bands['91-180 days']) > 0 ? '#ea580c' : '#9ca3af', fontWeight: 600 }}>
          {Number(r.bands['91-180 days'] || 0)}
        </span>
      ),
    },
    {
      title: '180+ Days (Dead Stock)',
      key: 'band_180_plus',
      align: 'right' as const,
      width: 140,
      render: (_: any, r: AgeingItem) => {
        const qty = Number(r.bands['180+ days'] || 0)
        return (
          <Tag color={qty > 0 ? 'error' : 'default'} style={{ fontWeight: qty > 0 ? 700 : 400 }}>
            {qty} units
          </Tag>
        )
      },
    },
    {
      title: 'Valuation (FIFO Cost)',
      dataIndex: 'total_valuation',
      key: 'total_valuation',
      align: 'right' as const,
      width: 160,
      render: (v: number) => (
        <Text strong style={{ color: '#0f766e', fontSize: '13.5px' }}>
          {formatINR(v)}
        </Text>
      ),
    },
  ]

  return (
    <div style={{ padding: '0px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
            Inventory Ageing & Valuation
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            FIFO receipt layer analysis identifying fresh vs slow-moving and dead stock duration.
          </Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} loading={loading} onClick={fetchAgeing}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Universal Product Search Selector */}
      <ProductSearchSelector
        value={selectedProductId}
        searchText={searchText}
        onSearchTextChange={(txt) => setSearchText(txt)}
        onSelectProduct={(id) => setSelectedProductId(id)}
        onClear={() => {
          setSelectedProductId(undefined)
          setSearchText('')
        }}
      />

      {/* Interactive KPI Cards Strip - Click to Filter by Ageing Band */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Total Valuation"
            value={formatINR(stats.totalValuation)}
            accentColor="#0f766e"
            badge={`${stats.totalUnits} units`}
            selected={ageingBandFilter === null}
            onClick={() => setAgeingBandFilter(null)}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Fresh Stock (0–30 Days)"
            value={`${stats.freshUnits} units`}
            accentColor="#16a34a"
            selected={ageingBandFilter === 'fresh'}
            onClick={() => setAgeingBandFilter(ageingBandFilter === 'fresh' ? null : 'fresh')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Slow Moving (91–180 Days)"
            value={`${stats.slowUnits} units`}
            accentColor="#ea580c"
            selected={ageingBandFilter === 'slow'}
            onClick={() => setAgeingBandFilter(ageingBandFilter === 'slow' ? null : 'slow')}
          />
        </Col>
        <Col xs={12} sm={6}>
          <ThinStatCard
            label="Dead Stock (180+ Days)"
            value={`${stats.deadUnits} units`}
            accentColor="#dc2626"
            selected={ageingBandFilter === 'dead'}
            onClick={() => setAgeingBandFilter(ageingBandFilter === 'dead' ? null : 'dead')}
          />
        </Col>
      </Row>

      {/* Multi-Dimensional Filters Card (Category, Subcategory, Brand) */}
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
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FilterOutlined style={{ color: '#2563eb' }} /> Filters:
            </span>

            {/* Category Dropdown */}
            <Select
              placeholder="All Categories"
              allowClear
              style={{ width: 180 }}
              value={selectedCategoryId}
              onChange={(val) => {
                setSelectedCategoryId(val)
                setSelectedSubcategoryId(undefined)
              }}
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 220, whiteSpace: 'nowrap' }}
              options={parentCategories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />

            {/* Subcategory Dropdown */}
            <Select
              placeholder="All Subcategories"
              allowClear
              style={{ width: 190 }}
              value={selectedSubcategoryId}
              onChange={(val) => setSelectedSubcategoryId(val)}
              disabled={subcategories.length === 0}
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 220, whiteSpace: 'nowrap' }}
              options={subcategories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />

            {/* Brand Dropdown */}
            <Select
              placeholder="All Brands"
              allowClear
              style={{ width: 170 }}
              value={selectedBrandId}
              onChange={(val) => setSelectedBrandId(val)}
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 220, whiteSpace: 'nowrap' }}
              options={brands.map((b) => ({
                value: b.id,
                label: b.name,
              }))}
            />

            {isFiltered && (
              <Button
                type="link"
                size="small"
                danger
                onClick={handleClearFilters}
                style={{ padding: 0 }}
              >
                Reset All Filters
              </Button>
            )}
          </Space>

          <Tag color="default" style={{ fontSize: '12px', padding: '2px 8px' }}>
            Showing {filteredItems.length} of {ageing?.items.length || 0} items
          </Tag>
        </div>
      </Card>

      {/* Main Ageing Breakdown Table */}
      <Card style={{ borderRadius: 8, border: '1px solid #e5e7eb' }} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="variant_id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
        />
      </Card>
    </div>
  )
}
