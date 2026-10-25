import React, { useState, useEffect } from 'react'
import {
  AutoComplete,
  Input,
  Typography,
  Row,
  Col,
  Card,
  Tag,
  Empty,
  Spin,
  Space,
  Popover,
  Button,
} from 'antd'
import {
  SearchOutlined,
  AppstoreOutlined,
  BlockOutlined,
  TagsOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  CloseCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { ProductSearchItem, ApiResponse, PaginatedResponse } from '../../api/types'

const { Title, Text, Paragraph } = Typography

export const LandingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const [searchTerm, setSearchTerm] = useState(initialQuery)
  const navigate = useNavigate()

  useEffect(() => {
    if (initialQuery !== searchTerm) {
      setSearchTerm(initialQuery)
    }
  }, [initialQuery])

  // Fetch search results (up to 50 items for responsive catalogue discovery)
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['products-search', searchTerm],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>(
        `/products/search?q=${encodeURIComponent(searchTerm)}&page=1&page_size=50`
      )
      return res.data
    },
  })

  // Quick statistics queries for unfiltered baseline counts
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-count'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/categories')
      return res.data.data
    },
  })

  const { data: brandsData } = useQuery({
    queryKey: ['brands-count'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/brands')
      return res.data.data
    },
  })

  const { data: locationsData } = useQuery({
    queryKey: ['locations-count'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/locations')
      return res.data.data
    },
  })

  // Handle local storage recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([])
  useEffect(() => {
    try {
      const stored = localStorage.getItem('stockpilot_recent_views')
      if (stored) {
        setRecentlyViewed(JSON.parse(stored))
      }
    } catch {
      // ignore
    }
  }, [])

  const onSearchChange = (val: string) => {
    setSearchTerm(val)
    if (val.trim()) {
      setSearchParams({ q: val.trim() })
    } else {
      setSearchParams({})
    }
  }

  const handleProductClick = (item: ProductSearchItem) => {
    try {
      const existing = recentlyViewed.filter((r) => r.id !== item.id)
      const updated = [item, ...existing].slice(0, 6)
      setRecentlyViewed(updated)
      localStorage.setItem('stockpilot_recent_views', JSON.stringify(updated))
    } catch {
      // ignore
    }
    navigate(`/products/${item.id}`)
  }

  // Dynamic calculations based on user's active search query
  const isFiltered = Boolean(searchTerm.trim())
  const matchedProducts = searchResults?.data || []

  const totalItemsCount = isFiltered
    ? (searchResults?.pagination?.total_items ?? matchedProducts.length)
    : (searchResults?.pagination?.total_items ?? 0)

  const distinctCategories = isFiltered
    ? (Array.from(new Set(matchedProducts.map((p) => p.category).filter(Boolean))) as string[])
    : []
  const categoriesCount = isFiltered ? distinctCategories.length : (categoriesData?.length ?? 0)

  const distinctBrands = isFiltered
    ? (Array.from(new Set(matchedProducts.map((p) => p.brand).filter(Boolean))) as string[])
    : []
  const brandsCount = isFiltered ? distinctBrands.length : (brandsData?.length ?? 0)

const cleanLocationName = (loc?: string) => (loc ? loc.replace(/\s*\[.*?\]\s*/g, '').trim() : '')

  const distinctLocations = isFiltered
    ? (Array.from(
        new Set(
          matchedProducts
            .flatMap((p) => p.locations || [])
            .map(cleanLocationName)
            .filter(Boolean)
        )
      ) as string[])
    : []
  const locationsCount = isFiltered ? distinctLocations.length : (locationsData?.length ?? 0)

  // AutoComplete dropdown options
  const searchOptions = matchedProducts.map((item) => ({
    value: item.name,
    product: item,
    label: (
      <div
        key={item.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 4px',
          gap: '12px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '10px',
              background: '#f1f5f9',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.primary_image_url ? (
              <img
                src={item.primary_image_url}
                alt={item.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <AppstoreOutlined style={{ color: '#94a3b8', fontSize: '22px' }} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Line 1: Product Title */}
            <div
              style={{
                fontWeight: 600,
                fontSize: '13.5px',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.name}
            </div>

            {/* Line 2: Category & Brand */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
              {item.category && (
                <Tag color="blue" style={{ fontSize: '11px', padding: '0 6px', margin: 0, lineHeight: '18px', borderRadius: '4px' }}>
                  {item.category}
                </Tag>
              )}
              {item.brand && (
                <Tag color="purple" style={{ fontSize: '11px', padding: '0 6px', margin: 0, lineHeight: '18px', borderRadius: '4px' }}>
                  {item.brand}
                </Tag>
              )}
            </div>

            {/* Line 3: Location on separate dedicated line */}
            {item.locations && item.locations.length > 0 && (
              <div style={{ marginTop: '3px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#c2410c',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '4px',
                    padding: '1px 7px',
                    lineHeight: '16px',
                    fontWeight: 500,
                  }}
                >
                  <EnvironmentOutlined style={{ fontSize: '10px' }} />
                  {cleanLocationName(item.locations[0])}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1677ff' }}>
            ₹{Number(item.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          {item.mrp && Number(item.mrp) > Number(item.selling_price) && (
            <div style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>
              ₹{Number(item.mrp).toLocaleString('en-IN')}
            </div>
          )}
        </div>
      </div>
    ),
  }))

  const handleSelectOption = (_value: string, option: any) => {
    if (option?.product) {
      handleProductClick(option.product)
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 0 48px' }}>
      {/* Hero Search Section */}
      <div
        style={{
          textAlign: 'center',
          padding: '32px 20px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '20px',
          color: '#ffffff',
          marginBottom: '20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 700, letterSpacing: '-0.5px' }}>
          Catalogue & Inventory Discovery
        </Title>
        <Paragraph
          style={{
            color: '#94a3b8',
            fontSize: '14px',
            marginTop: '6px',
            maxWidth: '620px',
            margin: '6px auto 20px',
          }}
        >
          Instantly search across products, SKUs, categories, brands, specifications, and warehouse locations.
        </Paragraph>

        {/* Center Search Bar with Interactive Dropdown */}
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <AutoComplete
            style={{ width: '100%' }}
            options={searchOptions}
            value={searchTerm}
            onSearch={onSearchChange}
            onSelect={handleSelectOption}
            popupMatchSelectWidth={true}
            dropdownStyle={{
              maxHeight: '440px',
              overflowY: 'auto',
              borderRadius: '16px',
              padding: '6px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
            }}
          >
            <Input
              size="large"
              prefix={<SearchOutlined style={{ color: '#1677ff', fontSize: '20px', marginRight: '8px' }} />}
              placeholder="Type to search e.g. 'bed king size', 'Sofa', 'Urban Ladder', 'Showroom'..."
              allowClear
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                height: '54px',
                borderRadius: '27px',
                fontSize: '16px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
              }}
            />
          </AutoComplete>
        </div>
      </div>

      {/* Sleek Compact Dynamic Metric Strip (Replaces bulky cards, saving ~70% vertical screen space) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: isFiltered ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
          padding: '10px 20px',
          marginBottom: '24px',
          boxShadow: isFiltered
            ? '0 4px 14px rgba(22, 119, 255, 0.08)'
            : '0 2px 4px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          transition: 'all 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {/* Items Metric */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1677ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              <AppstoreOutlined />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', lineHeight: 1.1 }}>
                {isFiltered ? 'Matched Items' : 'Total Items'}
              </Text>
              <Text strong style={{ fontSize: '16px', color: '#0f172a' }}>
                {totalItemsCount}
              </Text>
            </div>
          </div>

          <div style={{ width: '1px', height: '26px', background: '#e2e8f0' }} />

          {/* Categories Metric */}
          <Popover
            title={<span style={{ fontWeight: 600 }}>Matched Categories ({categoriesCount})</span>}
            content={
              <div style={{ maxWidth: '300px' }}>
                {distinctCategories.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {distinctCategories.map((c) => (
                      <Tag key={c} color="blue">{c}</Tag>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">All {categoriesData?.length ?? 0} product categories active</Text>
                )}
              </div>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}
              >
                <BlockOutlined />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', lineHeight: 1.1 }}>
                  Categories
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Text strong style={{ fontSize: '16px', color: '#0f172a' }}>
                    {categoriesCount}
                  </Text>
                  {isFiltered && distinctCategories.length === 1 && (
                    <Tag color="green" style={{ margin: 0, fontSize: '11px', lineHeight: '18px' }}>
                      {distinctCategories[0]}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </Popover>

          <div style={{ width: '1px', height: '26px', background: '#e2e8f0' }} />

          {/* Brands Metric */}
          <Popover
            title={<span style={{ fontWeight: 600 }}>Matched Brands ({brandsCount})</span>}
            content={
              <div style={{ maxWidth: '300px' }}>
                {distinctBrands.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {distinctBrands.map((b) => (
                      <Tag key={b} color="purple">{b}</Tag>
                    ))}
                  </div>
                ) : (
                  <Text type="secondary">All {brandsData?.length ?? 0} brands available</Text>
                )}
              </div>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#faf5ff',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}
              >
                <TagsOutlined />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', lineHeight: 1.1 }}>
                  Brands
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Text strong style={{ fontSize: '16px', color: '#0f172a' }}>
                    {brandsCount}
                  </Text>
                  {isFiltered && distinctBrands.length === 1 && (
                    <Tag color="purple" style={{ margin: 0, fontSize: '11px', lineHeight: '18px' }}>
                      {distinctBrands[0]}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </Popover>

          <div style={{ width: '1px', height: '26px', background: '#e2e8f0' }} />

          {/* Locations Metric */}
          <Popover
            title={
              <div style={{ fontWeight: 600 }}>
                📍 {isFiltered ? `Stocked Locations (${locationsCount})` : 'All Warehouse & Store Locations'}
              </div>
            }
            content={
              <div style={{ maxWidth: '340px' }}>
                {isFiltered ? (
                  distinctLocations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {distinctLocations.map((loc) => (
                        <div
                          key={loc}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#fff7ed',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fed7aa',
                            fontSize: '12px',
                            color: '#c2410c',
                            fontWeight: 500,
                          }}
                        >
                          <EnvironmentOutlined />
                          <span>{loc}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">No specific location assigned</Text>
                  )
                ) : (
                  <Text type="secondary">
                    Total of {locationsData?.length ?? 0} store floors and warehouse godowns
                  </Text>
                )}
              </div>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#fff7ed',
                  color: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}
              >
                <EnvironmentOutlined />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', lineHeight: 1.1 }}>
                  Locations
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Text strong style={{ fontSize: '16px', color: '#0f172a' }}>
                    {locationsCount}
                  </Text>
                  {isFiltered && distinctLocations.length > 0 && (
                    <Tag color="orange" style={{ margin: 0, fontSize: '11px', lineHeight: '18px' }}>
                      {distinctLocations.length === 1
                        ? distinctLocations[0]
                        : `${distinctLocations.length} locations`}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
          </Popover>

          <div style={{ width: '1px', height: '26px', background: '#e2e8f0' }} />

          {/* Live Stock Navigation Pill */}
          <div
            onClick={() => navigate('/stock/balances')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
              }}
            >
              <InboxOutlined />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', lineHeight: 1.1 }}>
                Live Inventory
              </Text>
              <Text strong style={{ fontSize: '13px', color: '#059669' }}>
                Stock & Transfers →
              </Text>
            </div>
          </div>
        </div>

        {/* Filter State / Clear Action */}
        {isFiltered && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag color="blue" style={{ margin: 0, borderRadius: '12px', padding: '2px 10px' }}>
              Filtered: "{searchTerm}"
            </Tag>
            <Button
              size="small"
              type="text"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => onSearchChange('')}
              style={{ fontSize: '12px', fontWeight: 500 }}
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Search Results Grid */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {searchTerm ? `Results for "${searchTerm}"` : 'Catalogue Highlights'}
          </Title>
          <Text type="secondary">
            {totalItemsCount} product{totalItemsCount === 1 ? '' : 's'} found
          </Text>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '64px' }}>
            <Spin size="large" tip="Searching catalogue..." />
          </div>
        ) : !searchResults?.data || searchResults.data.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '40px', borderRadius: '12px' }}>
            <Empty
              description={
                <span>
                  No products matched <b>"{searchTerm}"</b>.<br />
                  Try searching by SKU, Brand, Category, or Room location.
                </span>
              }
            />
          </Card>
        ) : (
          <Row gutter={[20, 20]}>
            {searchResults.data.map((item) => (
              <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                <Card
                  hoverable
                  className="hover-lift"
                  onClick={() => handleProductClick(item)}
                  cover={
                    <div
                      style={{
                        height: '180px',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      {item.primary_image_url ? (
                        <img
                          alt={item.name}
                          src={item.primary_image_url}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                          <AppstoreOutlined style={{ fontSize: '42px' }} />
                          <div style={{ fontSize: '11px', marginTop: '4px' }}>No Image</div>
                        </div>
                      )}
                      <Tag
                        color={item.is_active ? 'green' : 'default'}
                        style={{ position: 'absolute', top: 10, right: 10, margin: 0 }}
                      >
                        {item.is_active ? 'Active' : 'Archived'}
                      </Tag>
                    </div>
                  }
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                  }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.category && <Tag color="blue">{item.category}</Tag>}
                      {item.brand && <Tag color="purple">{item.brand}</Tag>}
                    </div>
                    {item.locations && item.locations.length > 0 && (
                      <div style={{ marginTop: '2px' }}>
                        <Tag color="orange" icon={<EnvironmentOutlined />} style={{ margin: 0, fontSize: '11px', borderRadius: '4px' }}>
                          {cleanLocationName(item.locations[0])}
                        </Tag>
                      </div>
                    )}

                    <Text strong style={{ fontSize: '15px', display: 'block', marginTop: '6px' }} ellipsis>
                      {item.name}
                    </Text>

                    <Text type="secondary" style={{ fontSize: '12px' }} ellipsis>
                      SKU: <b>{item.default_sku || 'N/A'}</b>
                    </Text>

                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <Text strong style={{ fontSize: '17px', color: '#1677ff' }}>
                        ₹{Number(item.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </Text>
                      {item.mrp && Number(item.mrp) > Number(item.selling_price) && (
                        <Text delete type="secondary" style={{ fontSize: '12px' }}>
                          ₹{Number(item.mrp).toLocaleString('en-IN')}
                        </Text>
                      )}
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* Recently Viewed Products */}
      {recentlyViewed.length > 0 && (
        <div>
          <Title level={4} style={{ marginBottom: '16px' }}>
            <EyeOutlined style={{ marginRight: '8px', color: '#1677ff' }} />
            Recently Viewed
          </Title>
          <Row gutter={[16, 16]}>
            {recentlyViewed.map((item) => (
              <Col xs={12} sm={8} md={4} key={item.id}>
                <Card
                  hoverable
                  onClick={() => navigate(`/products/${item.id}`)}
                  style={{ borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}
                  bodyStyle={{ padding: '12px' }}
                >
                  <Text strong style={{ fontSize: '13px', display: 'block' }} ellipsis>
                    {item.name}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    ₹{Number(item.selling_price || 0).toLocaleString('en-IN')}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </div>
  )
}
