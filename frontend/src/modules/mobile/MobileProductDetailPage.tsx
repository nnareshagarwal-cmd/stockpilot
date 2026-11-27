import React from 'react'
import { useParams } from 'react-router-dom'
import { Card, Spin, Tag, Typography, Empty, Divider } from 'antd'
import { EnvironmentOutlined, AppstoreOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { ApiResponse, ProductDetail } from '../../api/types'
import { formatIndianCurrency } from '../../utils/currency'

const { Title, Text } = Typography

export const MobileProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()

  const { data: product, isLoading } = useQuery({
    queryKey: ['mobile-product-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ProductDetail>>(`/products/${id}`)
      return res.data.data
    },
  })

  const { data: balances } = useQuery({
    queryKey: ['mobile-product-balances', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(`/stock/balances?product_id=${id}`)
      return res.data.data || []
    },
  })

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!product) {
    return <Empty description="Product not found" />
  }

  const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card style={{ borderRadius: 14 }} bodyStyle={{ padding: 14 }}>
        {primaryImage ? (
          <img
            src={primaryImage.file_url}
            alt={product.name}
            style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 10, background: '#f8fafc', marginBottom: 12 }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: 150,
              borderRadius: 10,
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              marginBottom: 12,
            }}
          >
            <AppstoreOutlined style={{ fontSize: 36 }} />
          </div>
        )}

        <Title level={4} style={{ margin: '0 0 6px', fontWeight: 700 }}>
          {product.name}
        </Title>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {product.category_name && <Tag color="blue">{product.category_name}</Tag>}
          {product.subcategory_name && <Tag color="geekblue">{product.subcategory_name}</Tag>}
          {product.brand_name && <Tag color="purple">{product.brand_name}</Tag>}
          <Tag color={product.is_active ? 'green' : 'default'}>{product.is_active ? 'Active' : 'Inactive'}</Tag>
        </div>
        {product.model && (
          <Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>
            Model: {product.model}
          </Text>
        )}
        {product.description && (
          <Text style={{ fontSize: 13, color: '#334155', display: 'block' }}>{product.description}</Text>
        )}
      </Card>

      <Card title="Stock by Location" size="small" style={{ borderRadius: 14 }}>
        {!balances || balances.length === 0 ? (
          <Text type="secondary">No stock recorded at any location.</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {balances.map((b: any, idx: number) => (
              <div
                key={b.id || idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: '#f8fafc',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    <EnvironmentOutlined /> {b.location_name || 'Unknown Location'}
                  </div>
                  <Text type="secondary" style={{ fontSize: 11.5 }}>
                    {b.sku} {b.condition_name ? `· ${b.condition_name}` : ''}
                  </Text>
                </div>
                <Tag color={Number(b.available_quantity ?? b.quantity_on_hand ?? 0) > 0 ? 'green' : 'default'}>
                  {b.available_quantity ?? b.quantity_on_hand ?? 0} units
                </Tag>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Variants & Pricing (${product.variants?.length || 0})`} size="small" style={{ borderRadius: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(product.variants || []).map((v) => (
            <div
              key={v.id}
              style={{
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{v.variant_name || 'Default Variant'}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  SKU: {v.sku}
                </Text>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1677ff' }}>
                  {formatIndianCurrency(v.selling_price)}
                </div>
                {v.mrp != null && Number(v.mrp) > Number(v.selling_price) && (
                  <div style={{ fontSize: 11.5, color: '#94a3b8', textDecoration: 'line-through' }}>
                    {formatIndianCurrency(v.mrp)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {(product.attributes?.length > 0 || product.height_mm || product.width_mm || product.depth_mm) && (
        <Card title="Specifications & Dimensions" size="small" style={{ borderRadius: 14 }}>
          {(product.height_mm || product.width_mm || product.depth_mm) && (
            <>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <Text strong>Dimensions (mm): </Text>
                H: {product.height_mm ?? '—'} × W: {product.width_mm ?? '—'} × D: {product.depth_mm ?? '—'}
              </div>
              {product.attributes?.length > 0 && <Divider style={{ margin: '8px 0' }} />}
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(product.attributes || []).map((attr) => (
              <div key={attr.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Text type="secondary">{attr.attribute_name}</Text>
                <Text strong>
                  {attr.formatted_value}
                  {attr.unit_label ? ` ${attr.unit_label}` : ''}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
