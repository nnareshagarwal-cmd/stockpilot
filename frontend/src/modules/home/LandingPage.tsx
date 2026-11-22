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
} from 'antd'
import {
  SearchOutlined,
  AppstoreOutlined,
  EnvironmentOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { ProductSearchItem, PaginatedResponse } from '../../api/types'

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

  const isFiltered = Boolean(searchTerm.trim())

  // Fetch search results (up to 50 items for responsive catalogue discovery)
  // When no search term is entered, show only in-stock products for Catalogue Highlights.
  // When user types a search term, search across ALL products (in-stock or catalog).
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['products-search', searchTerm],
    queryFn: async () => {
      const url = isFiltered
        ? `/products/search?q=${encodeURIComponent(searchTerm.trim())}&page=1&page_size=50`
        : `/products/search?in_stock=true&page=1&page_size=50`
      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>(url)
      return res.data
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

  const matchedProducts = searchResults?.data || []
  const totalItemsCount = searchResults?.pagination?.total_items ?? matchedProducts.length
  const cleanLocationName = (loc?: string) => (loc ? loc.replace(/\s*\[.*?\]\s*/g, '').trim() : '')

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
          {Boolean(item.mrp) && Number(item.mrp) > Number(item.selling_price) ? (
            <div style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>
              ₹{Number(item.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ) : null}
          {Number(item.total_stock) > 0 ? (
            <Tag color="green" style={{ margin: '4px 0 0 0', fontSize: '11px', lineHeight: '18px' }}>
              {item.total_stock} in stock
            </Tag>
          ) : null}
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
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {isFiltered ? `Results for "${searchTerm}"` : 'Catalogue Highlights'}
            </Title>
            {!isFiltered && (
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Showing available in-stock inventory across stores and godowns
              </Text>
            )}
          </div>
          <Text type="secondary">
            {totalItemsCount} product{totalItemsCount === 1 ? '' : 's'} {isFiltered ? 'found' : 'in stock'}
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

                    <div
                      style={{
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <Text strong style={{ fontSize: '17px', color: '#1677ff' }}>
                          ₹{Number(item.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                        {Boolean(item.mrp) && Number(item.mrp) > Number(item.selling_price) ? (
                          <Text delete type="secondary" style={{ fontSize: '12px' }}>
                            ₹{Number(item.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        ) : null}
                      </div>
                      {Number(item.total_stock) > 0 ? (
                        <Tag color="green" style={{ margin: 0, borderRadius: '4px', fontWeight: 600 }}>
                          {item.total_stock} in stock
                        </Tag>
                      ) : (
                        <Tag color="default" style={{ margin: 0, borderRadius: '4px' }}>
                          0 stock
                        </Tag>
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
                    ₹{Number(item.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
