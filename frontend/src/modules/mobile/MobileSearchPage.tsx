import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Spin, Empty, Tag, Typography } from 'antd'
import { SearchOutlined, EnvironmentOutlined, AppstoreOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { PaginatedResponse, ProductSearchItem } from '../../api/types'
import { formatIndianCurrency } from '../../utils/currency'

const { Title, Text } = Typography

export const MobileSearchPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const isFiltered = Boolean(searchTerm.trim())

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-product-search', searchTerm],
    queryFn: async () => {
      const url = isFiltered
        ? `/products/search?q=${encodeURIComponent(searchTerm.trim())}&page=1&page_size=40`
        : `/products/search?in_stock=true&page=1&page_size=40`
      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>(url)
      return res.data
    },
  })

  const items = data?.data || []
  const cleanLoc = (loc?: string) => (loc ? loc.replace(/\s*\[.*?\]\s*/g, '').trim() : '')

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 10, fontWeight: 700 }}>
        Product Search &amp; Stock
      </Title>
      <Input
        size="large"
        allowClear
        prefix={<SearchOutlined style={{ color: '#64748b' }} />}
        placeholder="Search name, SKU, brand, category..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ borderRadius: 12, marginBottom: 14, height: 46 }}
      />

      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <Empty description={isFiltered ? 'No products matched' : 'No in-stock products found'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => {
            const locations = item.locations || []
            const totalStock = item.total_stock ?? 0
            const locationText =
              locations.length > 1
                ? `${totalStock} ${totalStock === 1 ? 'unit' : 'units'} · ${locations.length} locations`
                : locations.length === 1
                  ? cleanLoc(locations[0])
                  : ''

            return (
              <div
                key={item.id}
                onClick={() => navigate(`/mobile/products/${item.id}`)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                {item.primary_image_url ? (
                  <img
                    src={item.primary_image_url}
                    alt={item.name}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    <AppstoreOutlined style={{ fontSize: 22 }} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#0f172a',
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {item.category && <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>{item.category}</Tag>}
                    {item.brand && <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>{item.brand}</Tag>}
                  </div>
                  {locationText && (
                    <Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
                      <EnvironmentOutlined /> {locationText}
                    </Text>
                  )}
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1677ff' }}>
                    {item.selling_price != null ? formatIndianCurrency(item.selling_price) : '—'}
                  </div>
                  {item.mrp != null && Number(item.mrp) > Number(item.selling_price || 0) && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8', textDecoration: 'line-through' }}>
                      {formatIndianCurrency(item.mrp)}
                    </div>
                  )}
                  <Tag
                    color={totalStock > 0 ? 'success' : 'error'}
                    style={{ margin: '4px 0 0', fontSize: 11 }}
                  >
                    {totalStock > 0 ? `${totalStock} in stock` : 'Out of stock'}
                  </Tag>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
