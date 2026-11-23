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
  Modal,
  Form,
  InputNumber,
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
  ColumnWidthOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, ProductDetail } from '../../../api/types'
import { cleanLocationName } from '../../stock/StockBalancesPage'

const { Title, Text, Paragraph } = Typography

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [dimModalOpen, setDimModalOpen] = useState(false)
  const [dimForm] = Form.useForm()

  const handleOpenDimensionModal = () => {
    if (product) {
      dimForm.setFieldsValue({
        height_mm: product.height_mm !== null && product.height_mm !== undefined ? Number(product.height_mm) : undefined,
        width_mm: product.width_mm !== null && product.width_mm !== undefined ? Number(product.width_mm) : undefined,
        depth_mm: product.depth_mm !== null && product.depth_mm !== undefined ? Number(product.depth_mm) : undefined,
        height_inches: product.height_inches !== null && product.height_inches !== undefined ? Number(product.height_inches) : undefined,
        width_inches: product.width_inches !== null && product.width_inches !== undefined ? Number(product.width_inches) : undefined,
        depth_inches: product.depth_inches !== null && product.depth_inches !== undefined ? Number(product.depth_inches) : undefined,
      })
    }
    setDimModalOpen(true)
  }

  const handleDimensionChange = (field: 'height' | 'width' | 'depth', unit: 'mm' | 'in', val: number | null) => {
    if (val === null || val === undefined || isNaN(val)) {
      dimForm.setFieldsValue({
        [`${field}_mm`]: null,
        [`${field}_inches`]: null,
      })
      return
    }

    if (unit === 'mm') {
      const inVal = Number((val / 25.4).toFixed(2))
      dimForm.setFieldsValue({
        [`${field}_inches`]: inVal,
      })
    } else {
      const mmVal = Number((val * 25.4).toFixed(1))
      dimForm.setFieldsValue({
        [`${field}_mm`]: mmVal,
      })
    }
  }

  const updateDimensionsMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        height_mm: values.height_mm !== undefined && values.height_mm !== null && values.height_mm !== '' ? Number(values.height_mm) : null,
        width_mm: values.width_mm !== undefined && values.width_mm !== null && values.width_mm !== '' ? Number(values.width_mm) : null,
        depth_mm: values.depth_mm !== undefined && values.depth_mm !== null && values.depth_mm !== '' ? Number(values.depth_mm) : null,
        height_inches: values.height_inches !== undefined && values.height_inches !== null && values.height_inches !== '' ? Number(values.height_inches) : null,
        width_inches: values.width_inches !== undefined && values.width_inches !== null && values.width_inches !== '' ? Number(values.width_inches) : null,
        depth_inches: values.depth_inches !== undefined && values.depth_inches !== null && values.depth_inches !== '' ? Number(values.depth_inches) : null,
      }
      await apiClient.put(`/products/${id}`, payload)
    },
    onSuccess: () => {
      message.success('Dimensions updated successfully')
      setDimModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['product-detail', id] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to update dimensions')
    },
  })

  const handleBack = () => {
    const returnSearch = (location.state as any)?.returnSearch
    if (returnSearch !== undefined) {
      navigate(`/products${returnSearch ? `?${returnSearch}` : ''}`)
    } else if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/products')
    }
  }

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

  const activeStockBalances = (stockBalances || []).filter((b: any) => Number(b.quantity) > 0)

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
        <Button style={{ marginTop: '16px' }} onClick={handleBack}>
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
      render: (mrp: number) =>
        mrp
          ? `₹${Number(mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '—',
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
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            Back to Products
          </Button>
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
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/products/${product.id}/edit`, { state: location.state })}
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
                  ? `₹${Number(product.variants[0].mrp).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                  <span>Stock by Location ({activeStockBalances.length})</span>
                </Space>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text type="secondary">
                      Showing locations currently holding stock for this product.
                    </Text>
                    <Button
                      type="primary"
                      icon={<ApartmentOutlined />}
                      onClick={() => navigate(`/stock/maintenance?product_id=${product.id}`)}
                    >
                      Manage Stock
                    </Button>
                  </div>
                  <Table
                    columns={stockColumns}
                    dataSource={activeStockBalances}
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
                            onClick={() => navigate(`/stock/maintenance?product_id=${product.id}`)}
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
              key: 'dimensions',
              label: (
                <Space size={4}>
                  <ColumnWidthOutlined />
                  <span>Dimensions</span>
                  {(product.height_mm || product.width_mm || product.depth_mm) && (
                    <Tag color="blue" style={{ marginLeft: 4, fontSize: '11px', borderRadius: '10px' }}>
                      Configured
                    </Tag>
                  )}
                </Space>
              ),
              children: !(product.height_mm || product.width_mm || product.depth_mm || product.height_inches || product.width_inches || product.depth_inches) ? (
                <Empty
                  description="No dimensions configured for this product yet"
                  style={{ padding: '32px 0' }}
                >
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={handleOpenDimensionModal}
                  >
                    Set Product Dimensions
                  </Button>
                </Empty>
              ) : (
                <div>
                  {/* Top Bar with summary and edit button */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f8fafc',
                      padding: '16px 20px',
                      borderRadius: '10px',
                      marginBottom: 24,
                      border: '1px solid #e2e8f0',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: '12px', marginBottom: 4 }}>
                        Overall Dimensions (W × D × H):
                      </Text>
                      <Space size={12} wrap>
                        <Tag color="blue" style={{ fontSize: '14px', padding: '4px 10px', fontWeight: 600 }}>
                          {product.width_mm || '—'} W × {product.depth_mm || '—'} D × {product.height_mm || '—'} H mm
                        </Tag>
                        <Tag color="geekblue" style={{ fontSize: '14px', padding: '4px 10px', fontWeight: 600 }}>
                          {product.width_inches || '—'}" W × {product.depth_inches || '—'}" D × {product.height_inches || '—'}" H
                        </Tag>
                      </Space>
                    </div>

                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={handleOpenDimensionModal}
                    >
                      Edit Dimensions
                    </Button>
                  </div>

                  {/* 3 Metric Cards */}
                  <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
                    <Col xs={24} md={8}>
                      <Card
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                            WIDTH (Side-to-Side)
                          </Text>
                          <Tag color="blue">W</Tag>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                          {product.width_mm ? `${Number(product.width_mm).toLocaleString()} mm` : '—'}
                        </div>
                        <Text type="secondary" style={{ fontSize: '14px' }}>
                          {product.width_inches ? `${product.width_inches} inches` : '—'}
                          {product.width_mm && ` (${(Number(product.width_mm) / 10).toFixed(1)} cm)`}
                        </Text>
                      </Card>
                    </Col>

                    <Col xs={24} md={8}>
                      <Card
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                            DEPTH (Front-to-Back)
                          </Text>
                          <Tag color="purple">D</Tag>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                          {product.depth_mm ? `${Number(product.depth_mm).toLocaleString()} mm` : '—'}
                        </div>
                        <Text type="secondary" style={{ fontSize: '14px' }}>
                          {product.depth_inches ? `${product.depth_inches} inches` : '—'}
                          {product.depth_mm && ` (${(Number(product.depth_mm) / 10).toFixed(1)} cm)`}
                        </Text>
                      </Card>
                    </Col>

                    <Col xs={24} md={8}>
                      <Card
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                            HEIGHT (Floor-to-Top)
                          </Text>
                          <Tag color="green">H</Tag>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                          {product.height_mm ? `${Number(product.height_mm).toLocaleString()} mm` : '—'}
                        </div>
                        <Text type="secondary" style={{ fontSize: '14px' }}>
                          {product.height_inches ? `${product.height_inches} inches` : '—'}
                          {product.height_mm && ` (${(Number(product.height_mm) / 10).toFixed(1)} cm)`}
                        </Text>
                      </Card>
                    </Col>
                  </Row>

                  {/* Dual-Unit Specifications Comparison Table */}
                  <Card title="Dimension Specifications Matrix" size="small" style={{ borderRadius: '10px' }}>
                    <Table
                      pagination={false}
                      size="middle"
                      columns={[
                        {
                          title: 'Dimension',
                          dataIndex: 'name',
                          key: 'name',
                          render: (text: string, r: any) => (
                            <Space>
                              <Text strong>{text}</Text>
                              <Tag color={r.tagColor}>{r.symbol}</Tag>
                            </Space>
                          ),
                        },
                        {
                          title: 'Millimeters (mm)',
                          dataIndex: 'mm',
                          key: 'mm',
                          render: (val: any) => (val ? <Text strong>{val} mm</Text> : '—'),
                        },
                        {
                          title: 'Centimeters (cm)',
                          dataIndex: 'cm',
                          key: 'cm',
                          render: (val: any) => (val ? `${val} cm` : '—'),
                        },
                        {
                          title: 'Inches (in)',
                          dataIndex: 'inches',
                          key: 'inches',
                          render: (val: any) => (val ? <Text style={{ color: '#1677ff', fontWeight: 600 }}>{val} in</Text> : '—'),
                        },
                      ]}
                      dataSource={[
                        {
                          key: 'width',
                          name: 'Width (Side to Side)',
                          symbol: 'W',
                          tagColor: 'blue',
                          mm: product.width_mm,
                          cm: product.width_mm ? (Number(product.width_mm) / 10).toFixed(1) : null,
                          inches: product.width_inches,
                        },
                        {
                          key: 'depth',
                          name: 'Depth (Front to Back)',
                          symbol: 'D',
                          tagColor: 'purple',
                          mm: product.depth_mm,
                          cm: product.depth_mm ? (Number(product.depth_mm) / 10).toFixed(1) : null,
                          inches: product.depth_inches,
                        },
                        {
                          key: 'height',
                          name: 'Height (Floor to Top)',
                          symbol: 'H',
                          tagColor: 'green',
                          mm: product.height_mm,
                          cm: product.height_mm ? (Number(product.height_mm) / 10).toFixed(1) : null,
                          inches: product.height_inches,
                        },
                      ]}
                    />
                  </Card>
                </div>
              ),
            },
            {
              key: 'specifications',
              label: `Technical Specs (${product.attributes.length})`,
              children:
                product.attributes.length === 0 ? (
                  <Empty
                    description="No technical specifications assigned yet"
                    style={{ padding: '24px 0' }}
                  >
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/products/${product.id}/edit`)}
                    >
                      Add Technical Specifications
                    </Button>
                  </Empty>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/products/${product.id}/edit`)}
                      >
                        Edit Specifications
                      </Button>
                    </div>
                    <Table
                      columns={specColumns}
                      dataSource={product.attributes}
                      rowKey="id"
                      pagination={false}
                    />
                  </div>
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

      {/* Modal: Quick Edit Dimensions */}
      <Modal
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Edit Product Dimensions
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Dual unit auto-conversion (mm ↔ inches). Enter either unit, both are updated and saved.
            </Text>
          </div>
        }
        open={dimModalOpen}
        onCancel={() => setDimModalOpen(false)}
        onOk={() => dimForm.submit()}
        confirmLoading={updateDimensionsMutation.isPending}
        width={650}
      >
        <Form form={dimForm} layout="vertical" onFinish={(val) => updateDimensionsMutation.mutate(val)}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Width (mm)" name="width_mm">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Width in mm (e.g. 1200)"
                  onChange={(val) => handleDimensionChange('width', 'mm', val)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Width (inches)" name="width_inches">
                <InputNumber
                  min={0}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="Width in inches (e.g. 47.24)"
                  onChange={(val) => handleDimensionChange('width', 'in', val)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Depth (mm)" name="depth_mm">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Depth in mm (e.g. 800)"
                  onChange={(val) => handleDimensionChange('depth', 'mm', val)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Depth (inches)" name="depth_inches">
                <InputNumber
                  min={0}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="Depth in inches (e.g. 31.50)"
                  onChange={(val) => handleDimensionChange('depth', 'in', val)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Height (mm)" name="height_mm">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="Height in mm (e.g. 750)"
                  onChange={(val) => handleDimensionChange('height', 'mm', val)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Height (inches)" name="height_inches">
                <InputNumber
                  min={0}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="Height in inches (e.g. 29.53)"
                  onChange={(val) => handleDimensionChange('height', 'in', val)}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
