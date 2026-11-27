import React, { useState } from 'react'
import {
  Input,
  Card,
  Button,
  Tag,
  Typography,
  Spin,
  Empty,
  InputNumber,
  Modal,
  message,
} from 'antd'
import {
  SearchOutlined,
  WhatsAppOutlined,
  CopyOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { CompanyStockItem, PaginatedResponse } from '../../api/types'

const { Title, Text, Paragraph } = Typography

interface CartEntry {
  product_id: string
  supplier_item_code: string
  item_name: string
  sku?: string
  quantity: number
  company_stock: number
}

export const MobileSupplierOrdersPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock'>('in_stock')
  const [cart, setCart] = useState<Record<string, CartEntry>>({})
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [supplierName, setSupplierName] = useState('Crystal')

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-company-stock', search, stockFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: '1',
        page_size: '40',
        stock_filter: stockFilter,
        sort_by: 'company_stock',
        sort_order: 'desc',
      })
      if (search.trim()) params.set('search', search.trim())
      const res = await apiClient.get<PaginatedResponse<CompanyStockItem>>(
        `/procurement/company-stock?${params.toString()}`
      )
      return res.data
    },
  })

  const items = data?.data || []
  const cartItems = Object.values(cart)

  const setQty = (record: CompanyStockItem, qty: number) => {
    const validQty = Math.max(0, Math.min(qty || 0, record.company_stock))
    setCart((prev) => {
      const next = { ...prev }
      if (validQty > 0) {
        next[record.product_id] = {
          product_id: record.product_id,
          supplier_item_code: record.supplier_item_code,
          item_name: record.item_name,
          sku: record.sku,
          quantity: validQty,
          company_stock: record.company_stock,
        }
      } else {
        delete next[record.product_id]
      }
      return next
    })
  }

  const orderText = [
    `Hello ${supplierName} Team,`,
    `Please confirm and dispatch the following order:`,
    '',
    ...cartItems.map(
      (it, idx) => `${idx + 1}. ${it.item_name} (${it.supplier_item_code}) — Qty: ${it.quantity}`
    ),
    '',
    `Total Items: ${cartItems.length} | Total Qty: ${cartItems.reduce((s, i) => s + i.quantity, 0)}`,
  ].join('\n')

  return (
    <div style={{ paddingBottom: cartItems.length > 0 ? 72 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          Supplier Orders
        </Title>
        <Button
          size="small"
          onClick={() => setStockFilter((s) => (s === 'in_stock' ? 'all' : 'in_stock'))}
        >
          {stockFilter === 'in_stock' ? 'Showing: In Stock' : 'Showing: All'}
        </Button>
      </div>

      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: '#64748b' }} />}
        placeholder="Search supplier item name or code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ borderRadius: 10, marginBottom: 12, height: 42 }}
      />

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No supplier stock items found" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => {
            const qty = cart[item.product_id]?.quantity || 0
            return (
              <Card key={item.product_id} size="small" style={{ borderRadius: 12 }} bodyStyle={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>{item.item_name}</div>
                    <Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
                      Code: {item.supplier_item_code} {item.sku ? `· SKU: ${item.sku}` : ''}
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                      <Tag color={item.company_stock > 0 ? 'blue' : 'default'} style={{ margin: 0, fontSize: 11 }}>
                        Company: {item.company_stock}
                      </Tag>
                      <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                        Store: {item.store_stock ?? 0}
                      </Tag>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Button
                      size="small"
                      disabled={qty <= 0}
                      onClick={() => setQty(item, qty - 1)}
                    >
                      −
                    </Button>
                    <InputNumber
                      size="small"
                      min={0}
                      max={item.company_stock}
                      value={qty}
                      onChange={(v) => setQty(item, Number(v || 0))}
                      style={{ width: 52, textAlign: 'center' }}
                    />
                    <Button
                      size="small"
                      disabled={qty >= item.company_stock}
                      onClick={() => setQty(item, qty + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {cartItems.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 640,
            background: '#0f172a',
            color: '#fff',
            padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            zIndex: 60,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{cartItems.length} item(s) selected</div>
            <Text style={{ color: '#94a3b8', fontSize: 11.5 }}>
              Total Qty: {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={() => setCart({})}
              ghost
            >
              Clear
            </Button>
            <Button
              type="primary"
              icon={<WhatsAppOutlined />}
              onClick={() => setOrderModalOpen(true)}
              style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
            >
              Order
            </Button>
          </div>
        </div>
      )}

      <Modal
        title="WhatsApp Order Summary"
        open={orderModalOpen}
        onCancel={() => setOrderModalOpen(false)}
        footer={[
          <Button
            key="copy"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(orderText)
              message.success('Order copied to clipboard')
            }}
          >
            Copy
          </Button>,
          <Button
            key="wa"
            type="primary"
            icon={<WhatsAppOutlined />}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
            onClick={() => {
              window.open(`https://wa.me/?text=${encodeURIComponent(orderText)}`, '_blank')
            }}
          >
            Send on WhatsApp
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 10 }}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Supplier Name
          </Text>
          <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
        </div>
        <Paragraph
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 10,
            whiteSpace: 'pre-wrap',
            fontSize: 12.5,
            marginBottom: 0,
          }}
        >
          {orderText}
        </Paragraph>
      </Modal>
    </div>
  )
}
