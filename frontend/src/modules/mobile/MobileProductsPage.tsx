import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Select, Spin, Empty, Tag, Typography } from 'antd'
import { SearchOutlined, AppstoreOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { PaginatedResponse, ProductSearchItem } from '../../api/types'
import { formatIndianCurrency } from '../../utils/currency'

const { Title, Text } = Typography

export const MobileProductsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-products-list', searchTerm, stockFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', page_size: '50' })
      if (searchTerm.trim()) params.set('q', searchTerm.trim())
      if (stockFilter === 'in_stock') params.set('in_stock', 'true')
      if (stockFilter === 'out_of_stock') params.set('in_stock', 'false')
      const res = await apiClient.get<PaginatedResponse<ProductSearchItem>>(`/products/search?${params.toString()}`)
      return res.data
    },
  })

  const products = data?.data || []

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 10, fontWeight: 700 }}>
        Products Catalogue
      </Title>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#64748b' }} />}
          placeholder="Search product or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ borderRadius: 10, flex: 1, height: 42 }}
        />
        <Select
          value={stockFilter}
          onChange={setStockFilter}
          style={{ width: 130, height: 42 }}
          options={[
            { label: 'All Stock', value: 'all' },
            { label: 'In Stock', value: 'in_stock' },
            { label: 'Out of Stock', value: 'out_of_stock' },
          ]}
        />
      </div>

      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      ) : products.length === 0 ? (
        <Empty description="No products found" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.map((item) => {
            const totalStock = item.total_stock ?? 0
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
                    style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 8,
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    <AppstoreOutlined style={{ fontSize: 20 }} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
                    {item.name}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                    {item.default_sku || 'No SKU'} {item.brand ? `· ${item.brand}` : ''}
                  </Text>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1677ff' }}>
                    {item.selling_price != null ? formatIndianCurrency(item.selling_price) : '—'}
                  </div>
                  <Tag color={totalStock > 0 ? 'green' : 'default'} style={{ margin: '4px 0 0', fontSize: 11 }}>
                    {totalStock} {totalStock === 1 ? 'unit' : 'units'}
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
