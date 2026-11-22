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
  Row,
  Col,
  InputNumber,
  Modal,
  Upload,
  message,
  Tooltip,
  Divider,
  Alert,
  Badge,
} from 'antd'
import {
  UploadOutlined,
  SearchOutlined,
  CopyOutlined,
  WhatsAppOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ShopOutlined,
  InboxOutlined,
  CalendarOutlined,
  FileExcelOutlined,
  ShoppingCartOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'
import {
  CompanyStockItem,
  CompanyStockSummary,
  CompanyStockUploadResult,
  ApiResponse,
  PaginatedResponse,
} from '../../api/types'
import { ThinStatCard } from '../../components/common/ThinStatCard'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

interface OrderItem {
  product_id: string
  supplier_item_code: string
  item_name: string
  sku?: string
  color?: string
  size?: string
  quantity: number
  company_stock: number
}

export const SupplierOrdersPage: React.FC = () => {
  const queryClient = useQueryClient()

  // Filter states
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [searchInput, setSearchInput] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(undefined)
  const [stockFilter, setStockFilter] = useState<string>('all')

  // Order Cart state: map of product_id -> OrderItem
  const [orderCart, setOrderCart] = useState<Record<string, OrderItem>>({})

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadSummary, setUploadSummary] = useState<CompanyStockUploadResult | null>(null)

  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false)
  const [supplierName, setSupplierName] = useState('Crystal')
  const [deliveryLocation, setDeliveryLocation] = useState('Home Decor Showroom')
  const [specialNotes, setSpecialNotes] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch summary stats
  const { data: summaryData } = useQuery({
    queryKey: ['company-stock-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CompanyStockSummary>>('/procurement/company-stock/summary')
      return res.data.data
    },
  })

  // Fetch categories for filters
  const { data: categories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/categories')
      return res.data.data
    },
  })

  const mainCategories = useMemo(() => {
    return categories?.filter((c: any) => !c.parent_id && c.is_active !== false) || []
  }, [categories])

  const subCategories = useMemo(() => {
    if (!categoryId) {
      return categories?.filter((c: any) => c.parent_id && c.is_active !== false) || []
    }
    return categories?.filter((c: any) => c.parent_id === categoryId && c.is_active !== false) || []
  }, [categories, categoryId])

  // Fetch paginated company stock items
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['company-stock', page, pageSize, search, categoryId, subcategoryId, stockFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        stock_filter: stockFilter,
        sort_by: 'company_stock',
        sort_order: 'desc',
      })
      if (search) params.append('search', search)
      if (categoryId) params.append('category_id', categoryId)
      if (subcategoryId) params.append('subcategory_id', subcategoryId)

      const res = await apiClient.get<PaginatedResponse<CompanyStockItem>>(`/procurement/company-stock?${params.toString()}`)
      return res.data
    },
  })

  // Handle Order Quantity changes in cart
  const handleQuantityChange = (record: CompanyStockItem, qty: number | null) => {
    const validQty = Math.max(0, Math.min(qty || 0, record.company_stock))
    setOrderCart((prev) => {
      const updated = { ...prev }
      if (validQty > 0) {
        updated[record.product_id] = {
          product_id: record.product_id,
          supplier_item_code: record.supplier_item_code,
          item_name: record.item_name,
          sku: record.sku,
          color: record.color,
          size: record.size,
          quantity: validQty,
          company_stock: record.company_stock,
        }
      } else {
        delete updated[record.product_id]
      }
      return updated
    })
  }

  // Cart totals
  const totalCartItems = Object.keys(orderCart).length
  const totalCartUnits = Object.values(orderCart).reduce((acc, curr) => acc + curr.quantity, 0)

  // Handle Excel upload
  const handleUploadFile = async (options: any) => {
    const { file, onSuccess, onError } = options
    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)
    try {
      const res = await apiClient.post<ApiResponse<CompanyStockUploadResult>>(
        '/procurement/company-stock/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setUploadSummary(res.data.data)
      message.success('Stock report processed and synced successfully!')
      queryClient.invalidateQueries({ queryKey: ['company-stock'] })
      queryClient.invalidateQueries({ queryKey: ['company-stock-summary'] })
      onSuccess('ok')
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to process Excel file'
      message.error(msg)
      onError(err)
    } finally {
      setUploading(false)
    }
  }

  // Construct formatted WhatsApp message
  const generatedWhatsAppMessage = useMemo(() => {
    const items = Object.values(orderCart)
    if (items.length === 0) return ''

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const refCode = `PO-CRYS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`

    const lines = [
      `*PURCHASE ORDER — HOME DECOR*`,
      `*Supplier:* ${supplierName}`,
      `*Date:* ${todayStr}`,
      `*Reference:* ${refCode}`,
      ``,
      `Please book and dispatch the following items from your latest stock list:`,
      ``,
    ]

    items.forEach((it, idx) => {
      lines.push(`${idx + 1}. *${it.item_name}*`)
      const subParts = []
      if (it.sku) subParts.push(`SKU: ${it.sku}`)
      if (it.supplier_item_code) subParts.push(`Supplier Code: ${it.supplier_item_code}`)
      if (subParts.length > 0) lines.push(`   • ${subParts.join(' | ')}`)

      const specs = []
      if (it.color) specs.push(`Color: ${it.color}`)
      if (it.size) specs.push(`Size: ${it.size}`)
      if (specs.length > 0) lines.push(`   • ${specs.join(' | ')}`)

      lines.push(`   • *Order Quantity: ${it.quantity} pcs*`)
      lines.push(``)
    })

    lines.push(`----------------------------------------`)
    lines.push(`*Total Products:* ${items.length} items`)
    lines.push(`*Total Quantity:* ${totalCartUnits} pieces`)
    lines.push(`*Delivery Location:* ${deliveryLocation}`)
    if (specialNotes.trim()) {
      lines.push(`*Special Notes:* ${specialNotes.trim()}`)
    }
    lines.push(`----------------------------------------`)
    lines.push(`Kindly confirm stock reservation and dispatch date.`)

    return lines.join('\n')
  }, [orderCart, supplierName, deliveryLocation, specialNotes, totalCartUnits])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedWhatsAppMessage)
    message.success('Purchase order message copied to clipboard!')
  }

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(generatedWhatsAppMessage)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  // Grid columns
  const columns = [
    {
      title: 'Product & Supplier Reference',
      key: 'product',
      width: 320,
      render: (_: any, record: CompanyStockItem) => (
        <div>
          <Text strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', lineHeight: 1.3 }}>
            {record.item_name}
          </Text>
          {record.description && record.description !== record.item_name && (
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px', lineHeight: 1.3 }}>
              {record.description}
            </Text>
          )}
          <Space size={6} wrap style={{ marginTop: '6px' }}>
            {record.sku && (
              <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                {record.sku}
              </Tag>
            )}
            {record.supplier_item_code && record.supplier_item_code !== record.item_name && (
              <Tag color="geekblue" style={{ fontSize: '11px', margin: 0 }}>
                Code: {record.supplier_item_code}
              </Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      width: 170,
      render: (_: any, record: CompanyStockItem) => (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block' }}>
            {record.category_name || '—'}
          </Text>
          {record.subcategory_name && (
            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              {record.subcategory_name}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Size & Color',
      key: 'specs',
      width: 190,
      render: (_: any, record: CompanyStockItem) => (
        <div>
          {record.color ? (
            <div style={{ marginBottom: '2px' }}>
              <Tag color="orange" style={{ fontSize: '11px', margin: 0 }}>
                {record.color}
              </Tag>
            </div>
          ) : null}
          {record.size ? (
            <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
              📏 {record.size}
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: '11px' }}>—</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Company Stock',
      dataIndex: 'company_stock',
      key: 'company_stock',
      align: 'right' as const,
      width: 130,
      render: (qty: number) =>
        qty > 0 ? (
          <Tag color="success" style={{ fontWeight: 600, fontSize: '12px', padding: '2px 8px' }}>
            {Number(qty).toLocaleString()} pcs
          </Tag>
        ) : (
          <Tag color="default" style={{ fontSize: '11px' }}>
            0 pcs
          </Tag>
        ),
    },
    {
      title: 'In-Store Stock',
      dataIndex: 'store_stock',
      key: 'store_stock',
      align: 'right' as const,
      width: 140,
      render: (qty: number) =>
        qty > 0 ? (
          <Tag color="blue" style={{ fontWeight: 600, fontSize: '12px', padding: '2px 8px' }}>
            {Number(qty).toLocaleString()} pcs
          </Tag>
        ) : (
          <Tag color="error" style={{ fontSize: '11px', padding: '2px 8px' }}>
            0 pcs (Out of Stock)
          </Tag>
        ),
    },
    {
      title: 'Order Quantity',
      key: 'order_qty',
      align: 'center' as const,
      width: 170,
      render: (_: any, record: CompanyStockItem) => {
        const selectedQty = orderCart[record.product_id]?.quantity || 0
        const isSelected = selectedQty > 0
        return (
          <Space direction="vertical" size={2} align="center">
            <InputNumber
              min={0}
              max={record.company_stock}
              value={selectedQty}
              onChange={(val) => handleQuantityChange(record, val)}
              disabled={record.company_stock === 0}
              style={{
                width: 90,
                borderColor: isSelected ? '#1677ff' : undefined,
                background: isSelected ? '#eff6ff' : undefined,
                fontWeight: isSelected ? 700 : 400,
              }}
              placeholder="0"
            />
            {record.company_stock > 0 && (
              <Space size={4}>
                <Button
                  size="small"
                  type="link"
                  style={{ fontSize: '11px', padding: 0 }}
                  onClick={() => handleQuantityChange(record, selectedQty + 1)}
                  disabled={selectedQty >= record.company_stock}
                >
                  +1
                </Button>
                <Divider type="vertical" style={{ margin: '0 2px' }} />
                <Button
                  size="small"
                  type="link"
                  style={{ fontSize: '11px', padding: 0 }}
                  onClick={() => handleQuantityChange(record, record.company_stock)}
                >
                  Max
                </Button>
                {isSelected && (
                  <>
                    <Divider type="vertical" style={{ margin: '0 2px' }} />
                    <Button
                      size="small"
                      type="link"
                      danger
                      style={{ fontSize: '11px', padding: 0 }}
                      onClick={() => handleQuantityChange(record, 0)}
                    >
                      Clear
                    </Button>
                  </>
                )}
              </Space>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ paddingBottom: totalCartItems > 0 ? '90px' : '40px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Supplier Orders — Crystal
          </Title>
          <Text type="secondary">
            Live comparison of Crystal factory inventory vs your showroom stock. Select order items and generate WhatsApp POs.
          </Text>
        </div>
        <Space size={12}>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => {
              setUploadSummary(null)
              setIsUploadModalOpen(true)
            }}
          >
            Upload Stock Report (.xlsx)
          </Button>
        </Space>
      </div>

      {/* Freshness Banner */}
      <Alert
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>
              <CalendarOutlined style={{ marginRight: 6, color: '#1677ff' }} />
              <strong>Company Stock As Of:</strong>{' '}
              {summaryData?.last_report_date
                ? new Date(summaryData.last_report_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '20-Aug-2026'}{' '}
              {summaryData?.last_filename && (
                <span style={{ color: '#64748b' }}>({summaryData.last_filename})</span>
              )}
            </span>
            <span style={{ fontSize: '12px', color: '#475569' }}>
              🔒 Company stock is kept strictly segregated from store stock balances.
            </span>
          </div>
        }
        type="info"
        showIcon={false}
        style={{ marginBottom: 14, borderRadius: 8, border: '1px solid #bfdbfe', background: '#f0f9ff' }}
      />

      {/* Metrics Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={12} md={6}>
          <ThinStatCard
            label="Ready at Crystal Factory"
            value={summaryData?.total_company_stock || 0}
            accentColor="#10b981"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ThinStatCard
            label="Total Products in Feed"
            value={summaryData?.total_products || 0}
            accentColor="#2563eb"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ThinStatCard
            label="Out of Stock in Showroom"
            value={summaryData?.out_of_stock_in_store_count || 0}
            accentColor="#ef4444"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ThinStatCard
            label="Available in Showroom"
            value={summaryData?.total_store_stock || 0}
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
            {/* Search */}
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search product, SKU, code, color, size..."
              allowClear
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: 280 }}
            />

            {/* Main Category */}
            <Select
              showSearch
              placeholder="All Main Categories"
              allowClear
              style={{ width: 190 }}
              value={categoryId}
              onChange={(val) => {
                setCategoryId(val)
                setSubcategoryId(undefined)
                setPage(1)
              }}
              optionFilterProp="label"
              options={mainCategories.map((c: any) => ({ label: c.name, value: c.id }))}
            />

            {/* Subcategory */}
            <Select
              showSearch
              placeholder={categoryId ? 'All Subcategories' : 'Subcategory'}
              allowClear
              style={{ width: 190 }}
              value={subcategoryId}
              onChange={(val) => {
                setSubcategoryId(val)
                setPage(1)
              }}
              optionFilterProp="label"
              options={subCategories.map((sc: any) => ({ label: sc.name, value: sc.id }))}
            />

            {/* Stock Filter */}
            <Select
              style={{ width: 180 }}
              value={stockFilter}
              onChange={(val) => {
                setStockFilter(val)
                setPage(1)
              }}
              options={[
                { label: 'All Items', value: 'all' },
                { label: 'Ready at Crystal (> 0)', value: 'in_company_stock' },
                { label: 'Out of Stock in Store (0)', value: 'out_of_store' },
                { label: 'In Store Stock (> 0)', value: 'in_store' },
              ]}
            />

            {/* Reset */}
            {(searchInput || categoryId || subcategoryId || stockFilter !== 'all') && (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  setCategoryId(undefined)
                  setSubcategoryId(undefined)
                  setStockFilter('all')
                  setPage(1)
                }}
                style={{ padding: 0 }}
              >
                Reset Filters
              </Button>
            )}
          </Space>

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
              Showing <strong>{stockData?.data?.length || 0}</strong> of{' '}
              <strong>{stockData?.pagination?.total_items || 0}</strong> items
            </Tag>
          </div>
        </div>
      </Card>

      {/* Main Comparison Grid */}
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
          dataSource={stockData?.data || []}
          rowKey="id"
          loading={isLoading}
          rowClassName={(record) => ((orderCart[record.product_id]?.quantity || 0) > 0 ? 'bg-blue-50/40' : '')}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: stockData?.pagination?.total_items || 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      {/* Floating Bottom Order Drawer / Bar */}
      {totalCartItems > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#ffffff',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
            borderTop: '1px solid #e2e8f0',
            padding: '14px 32px',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space size={16} align="center">
            <Badge count={totalCartItems} style={{ backgroundColor: '#10b981' }}>
              <ShoppingCartOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
            </Badge>
            <div>
              <Text strong style={{ fontSize: '15px', color: '#0f172a' }}>
                {totalCartItems} Products Selected
              </Text>
              <Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>
                Total Order Quantity:{' '}
                <strong style={{ color: '#10b981', fontSize: '13px' }}>{totalCartUnits} pieces</strong>
              </Text>
            </div>
          </Space>

          <Space size={12}>
            <Button
              icon={<ClearOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: 'Clear order selections?',
                  content: 'This will reset all selected item quantities back to 0.',
                  onOk: () => setOrderCart({}),
                })
              }}
            >
              Clear
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<WhatsAppOutlined />}
              style={{
                backgroundColor: '#25D366',
                borderColor: '#25D366',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
              }}
              onClick={() => setIsWhatsAppModalOpen(true)}
            >
              Generate WhatsApp Order ({totalCartUnits} pcs)
            </Button>
          </Space>
        </div>
      )}

      {/* Upload Stock Report Modal */}
      <Modal
        title={
          <Space>
            <FileExcelOutlined style={{ color: '#10b981', fontSize: '20px' }} />
            <span>Upload Crystal Stock Report (.xlsx)</span>
          </Space>
        }
        open={isUploadModalOpen}
        onCancel={() => setIsUploadModalOpen(false)}
        footer={null}
        destroyOnClose
        width={560}
      >
        <div style={{ marginTop: '16px' }}>
          <Paragraph type="secondary" style={{ fontSize: '13px' }}>
            Upload the latest <strong>Stock Report</strong> Excel sheet sent by Crystal. New products will automatically be created in your catalogue with <strong>CRYS-...</strong> SKUs, and existing factory availability numbers will be safely updated without affecting your showroom stock.
          </Paragraph>

          <Dragger
            customRequest={handleUploadFile}
            accept=".xlsx,.xls"
            showUploadList={false}
            disabled={uploading}
            style={{ padding: '24px', background: '#f8fafc', borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: '48px', color: '#10b981' }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: '14px', fontWeight: 600 }}>
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint" style={{ fontSize: '12px', color: '#64748b' }}>
              Supports official Crystal Excel stock reports (e.g. <code>Stock Report 20.08.2026.xlsx</code>)
            </p>
          </Dragger>

          {uploadSummary && (
            <div style={{ marginTop: 20 }}>
              <Alert
                message="Upload & Sync Completed"
                description={
                  <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                    <div>
                      • <strong>File:</strong> {uploadSummary.filename}
                    </div>
                    <div>
                      • <strong>Report Date:</strong> {uploadSummary.report_date || 'N/A'}
                    </div>
                    <div>
                      • <strong>Total Items Processed:</strong> {uploadSummary.total_rows_processed}
                    </div>
                    <div>
                      • <strong>Total Factory Stock:</strong> {uploadSummary.total_company_stock} pieces
                    </div>
                    <div>
                      • <strong>New Catalogue Products Added:</strong> {uploadSummary.new_products_created}
                    </div>
                  </div>
                }
                type="success"
                showIcon
              />
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Button type="primary" onClick={() => setIsUploadModalOpen(false)}>
                  Done & View Grid
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* WhatsApp Order Preview Modal */}
      <Modal
        title={
          <Space>
            <WhatsAppOutlined style={{ color: '#25D366', fontSize: '22px' }} />
            <span>Review & Send WhatsApp Purchase Order</span>
          </Space>
        }
        open={isWhatsAppModalOpen}
        onCancel={() => setIsWhatsAppModalOpen(false)}
        width={680}
        footer={[
          <Button key="close" onClick={() => setIsWhatsAppModalOpen(false)}>
            Close
          </Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={copyToClipboard}>
            Copy Message
          </Button>,
          <Button
            key="whatsapp"
            type="primary"
            icon={<WhatsAppOutlined />}
            style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
            onClick={openWhatsApp}
          >
            Open in WhatsApp
          </Button>,
        ]}
      >
        <div style={{ marginTop: 12 }}>
          {/* Form controls for header customization */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Text strong style={{ fontSize: '12px' }}>Supplier / Brand Name:</Text>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} style={{ marginTop: 4 }} />
            </Col>
            <Col span={12}>
              <Text strong style={{ fontSize: '12px' }}>Showroom Delivery Location:</Text>
              <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} style={{ marginTop: 4 }} />
            </Col>
            <Col span={24}>
              <Text strong style={{ fontSize: '12px' }}>Special Instructions / Transport (Optional):</Text>
              <Input
                placeholder="e.g. Dispatch via Manoj Roadways, door delivery required"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 8 }}>
            WhatsApp Message Preview:
          </Text>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              maxHeight: '340px',
              overflowY: 'auto',
              color: '#1e293b',
              lineHeight: 1.5,
            }}
          >
            {generatedWhatsAppMessage}
          </div>
        </div>
      </Modal>
    </div>
  )
}