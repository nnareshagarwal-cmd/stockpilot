import React, { useState } from 'react'
import {
  Typography,
  Card,
  Tabs,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Descriptions,
  Table,
  Image,
  Upload,
  message,
  Divider,
  Empty,
  Popconfirm,
  Badge,
  Spin,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  UploadOutlined,
  StarOutlined,
  StarFilled,
  DeleteOutlined,
  AppstoreOutlined,
  ShopOutlined,
  InboxOutlined,
  ApartmentOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, ProductDetail } from '../../../api/types'
import { cleanLocationName } from '../../stock/StockBalancesPage'

const { Title, Text, Paragraph } = Typography

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product-detail', id],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ProductDetail>>(`/products/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })

  // Fetch live stock balances across locations
  const { data: stockBalances, isLoading: isStockLoading } = useQuery({
    queryKey: ['product-stock', id],
    queryFn: async () => {
      const res = await apiClient.get('/stock/balances', {
        params: { search: product?.name, page_size: 100 },
      })
      const items = res.data.data || []
      return items.filter((b: any) => b.product_id === id)
    },
    enabled: !!id && !!product,
  })

  // Set primary image mutation
  const setPrimaryMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await apiClient.put(`/products/${id}/images/${imageId}`, { is_primary: true })
    },
    onSuccess: () => {
      message.success('Primary image updated')
      queryClient.invalidateQueries({ queryKey: ['product-detail', id] })
    },
  })

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await apiClient.delete(`/products/${id}/images/${imageId}`)
    },
    onSuccess: () => {
      message.success('Image deleted')
      queryClient.invalidateQueries({ queryKey: ['product-detail', id] })
    },
  })

  // Upload more images
  const handleUploadFiles = async (options: any) => {
    const { file, onSuccess, onError } = options
    const formData = new FormData()
    formData.append('files', file)
    try {
      await apiClient.post(`/products/${id}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      message.success('Image uploaded')
      onSuccess('ok')
      queryClient.invalidateQueries({ queryKey: ['product-detail', id] })
    } catch (err) {
      message.error('Failed to upload image')
      onError(err)
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" tip="Loading product details..." />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <Card style={{ textAlign: 'center', padding: '60px', borderRadius: '12px' }}>
        <Empty description="Product not found" />
        <Button style={{ marginTop: '16px' }} onClick={() => navigate('/products')}>
          Back to Products
        </Button>
      </Card>
    )
  }

  const primaryImage = product.images.find((img) => img.is_primary) || product.images[0]

  const variantColumns = [
    {
      title: 'Product / Variant Name',
      dataIndex: 'variant_name',
      key: 'variant_name',
      render: (name: string) => (
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          {name || product?.name || 'Standard'}
        </span>
      ),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => (
        <Tag color="blue" style={{ fontFamily: 'monospace' }}>
          {sku}
        </Tag>
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit_name',
      key: 'unit',
      render: (u: string, r: any) => (u ? `${u} (${r.unit_code})` : '—'),
    },
    {
      title: 'Purchase Price',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      render: (p: number) => `₹${Number(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      render: (p: number) => (
        <Text strong style={{ color: '#1677ff' }}>
          ₹{Number(p).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'MRP',
      dataIndex: 'mrp',
      key: 'mrp',
      render: (mrp: number) => (mrp ? `₹${Number(mrp).toLocaleString('en-IN')}` : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (act: boolean) => <Tag color={act ? 'green' : 'default'}>{act ? 'Active' : 'Inactive'}</Tag>,
    },
  ]

  const specColumns = [
    {
      title: 'Specification / Attribute',
      dataIndex: 'attribute_name',
      key: 'name',
      width: '40%',
      render: (name: string, record: any) => (
        <Space>
          <Text strong>{name}</Text>
          {record.unit_label && <Tag>{record.unit_label}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'formatted_value',
      key: 'value',
      render: (val: string) => <Text style={{ fontSize: '15px' }}>{val || '—'}</Text>,
    },
  ]

  const stockColumns = [
    {
      title: 'Variant & SKU',
      key: 'variant',
      render: (_: any, r: any) => (
        <div>
          <Text strong>{r.variant_name || r.product_name}</Text>
          <div>
            <Tag style={{ fontSize: '11px', fontFamily: 'monospace' }}>{r.sku}</Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: any, r: any) => (
        <Space size={4}>
          <ShopOutlined style={{ color: '#d97706' }} />
          <Text strong>{cleanLocationName(r.location_name || '')}</Text>
        </Space>
      ),
    },
    {
      title: 'Condition',
      key: 'condition',
      render: (_: any, r: any) => {
        const isGood = r.condition_name?.toLowerCase().includes('good')
        const isDamaged = r.condition_name?.toLowerCase().includes('damage')
        const color = isGood ? 'success' : isDamaged ? 'error' : 'purple'
        return <Tag color={color}>{r.condition_name}</Tag>
      },
    },
    {
      title: 'Total Stock',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (q: number) => <Text strong>{Number(q).toLocaleString()}</Text>,
    },
    {
      title: 'Available to Sell',
      dataIndex: 'quantity',
      key: 'available_to_sell',
      align: 'right' as const,
      render: (q: number, r: any) => (
        <Tag color={r.is_sellable && Number(q) > 0 ? 'green' : 'default'} style={{ fontWeight: 600 }}>
          {r.is_sellable ? Number(q).toLocaleString() : '0'}
        </Tag>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Top Breadcrumb & Controls */}
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
        <Space size={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                {product.name}
              </Title>
              <Tag color={product.is_active ? 'green' : 'default'}>
                {product.is_active ? 'Active' : 'Archived'}
              </Tag>
            </div>
            <Space size={8} style={{ marginTop: '4px' }}>
              {product.category_name && <Tag color="blue">{product.category_name}</Tag>}
              {product.brand_name && <Tag color="purple">{product.brand_name}</Tag>}
              {product.model && <Text type="secondary">Model: {product.model}</Text>}
            </Space>
          </div>
        </Space>

        <Space>
          <Button
            icon={<ApartmentOutlined />}
            onClick={() => navigate(`/stock/mapping?product_id=${product.id}`)}
          >
            Stock Mapping
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/products/${product.id}/edit`)}
          >
            Edit Product
          </Button>
        </Space>
      </div>

      {/* Main Info Card */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} md={8}>
          <Card
            style={{ borderRadius: '12px', overflow: 'hidden', textAlign: 'center' }}
            bodyStyle={{ padding: 0 }}
          >
            <div
              style={{
                height: '300px',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {primaryImage ? (
                <Image
                  src={primaryImage.file_url}
                  alt={product.name}
                  style={{ width: '100%', height: '300px', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ color: '#94a3b8' }}>
                  <AppstoreOutlined style={{ fontSize: '64px' }} />
                  <div style={{ marginTop: '8px' }}>No Product Image</div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card style={{ borderRadius: '12px', height: '100%' }}>
            <Descriptions title="Key Overview" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Primary SKU">
                <Tag color="geekblue">{product.variants[0]?.sku || 'None'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Selling Price">
                <Text strong style={{ fontSize: '18px', color: '#1677ff' }}>
                  ₹{Number(product.variants[0]?.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="MRP">
                {product.variants[0]?.mrp
                  ? `₹${Number(product.variants[0].mrp).toLocaleString('en-IN')}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="GST Rate">
                {product.tax_rate_percent !== undefined && product.tax_rate_percent !== null
                  ? `${product.tax_rate_name || 'GST'} (${product.tax_rate_percent}%)`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Variants">
                {product.variants.length} SKU(s)
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {new Date(product.created_at).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>

            {product.description && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Text strong style={{ display: 'block', marginBottom: '6px' }}>
                  Description:
                </Text>
                <Paragraph style={{ color: '#475569' }}>{product.description}</Paragraph>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card style={{ borderRadius: '12px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k)}
          items={[
            {
              key: 'overview',
              label: 'Variants & Pricing',
              children: (
                <Table
                  columns={variantColumns}
                  dataSource={product.variants}
                  rowKey="id"
                  pagination={false}
                />
              ),
            },
            {
              key: 'stock',
              label: (
                <Space size={4}>
                  <InboxOutlined />
                  <span>Stock by Location ({stockBalances?.length || 0})</span>
                </Space>
              ),
              children:
                (stockBalances || []).length === 0 ? (
                  <Empty description="No physical stock recorded for this product yet" />
                ) : (
                  <Table
                    loading={isStockLoading}
                    columns={stockColumns}
                    dataSource={stockBalances || []}
                    rowKey="id"
                    pagination={false}
                  />
                ),
            },
            {
              key: 'specifications',
              label: `Technical Specs (${product.attributes.length})`,
              children:
                product.attributes.length === 0 ? (
                  <Empty description="No technical specifications assigned yet" />
                ) : (
                  <Table
                    columns={specColumns}
                    dataSource={product.attributes}
                    rowKey="id"
                    pagination={false}
                  />
                ),
            },
            {
              key: 'images',
              label: `Gallery (${product.images.length})`,
              children: (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <Upload
                      customRequest={handleUploadFiles}
                      showUploadList={false}
                      accept="image/png, image/jpeg, image/webp"
                    >
                      <Button icon={<UploadOutlined />}>Upload New Image</Button>
                    </Upload>
                  </div>

                  {product.images.length === 0 ? (
                    <Empty description="No images uploaded" />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {product.images.map((img) => (
                        <Col xs={24} sm={12} md={6} key={img.id}>
                          <Card
                            hoverable
                            cover={
                              <div style={{ height: '180px', overflow: 'hidden' }}>
                                <Image
                                  src={img.file_url}
                                  alt={img.file_name}
                                  style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                                />
                              </div>
                            }
                            actions={[
                              img.is_primary ? (
                                <Text key="primary" type="success">
                                  <StarFilled /> Primary
                                </Text>
                              ) : (
                                <Button
                                  key="set-primary"
                                  type="text"
                                  icon={<StarOutlined />}
                                  onClick={() => setPrimaryMutation.mutate(img.id)}
                                >
                                  Make Primary
                                </Button>
                              ),
                              <Popconfirm
                                key="del"
                                title="Delete image?"
                                onConfirm={() => deleteImageMutation.mutate(img.id)}
                              >
                                <Button type="text" danger icon={<DeleteOutlined />} />
                              </Popconfirm>,
                            ]}
                          >
                            <Text ellipsis style={{ fontSize: '12px' }}>
                              {img.caption || img.file_name}
                            </Text>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>
              ),
            },
            {
              key: 'stock',
              label: 'Stock by Location',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text type="secondary">
                      Showing locations currently holding stock for this product.
                    </Text>
                    <Button
                      type="primary"
                      icon={<ApartmentOutlined />}
                      onClick={() => navigate(`/stock/mapping?product_id=${product.id}`)}
                    >
                      Manage Stock Mapping
                    </Button>
                  </div>
                  <Table
                    columns={stockColumns}
                    dataSource={(stockBalances || []).filter((b: any) => Number(b.quantity) > 0)}
                    rowKey="id"
                    loading={isStockLoading}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty
                          description="No stock currently allocated to any location."
                          style={{ padding: '24px 0' }}
                        >
                          <Button
                            type="primary"
                            icon={<ApartmentOutlined />}
                            onClick={() => navigate(`/stock/mapping?product_id=${product.id}`)}
                          >
                            Allocate Stock at Location
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'movements',
              label: 'Stock Movements (Phase 2)',
              children: (
                <Empty description="Stock movement ledger and audit logs will be enabled in Phase 2." />
              ),
            },
            {
              key: 'purchasing',
              label: 'Purchase History (Phase 3)',
              children: (
                <Empty description="Purchase orders and GRNs for this product will be available in Phase 3." />
              ),
            },
            {
              key: 'sales',
              label: 'Sales History (Phase 4)',
              children: (
                <Empty description="Sales invoices, customer orders, and dispatch logs will be enabled in Phase 4." />
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
