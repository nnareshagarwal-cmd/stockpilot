import React, { useState, useEffect, useRef } from 'react'
import { AutoComplete, Input, Button, Tag, Space } from 'antd'
import { SearchOutlined, CloseOutlined } from '@ant-design/icons'
import apiClient from '../../api/client'

export interface ProductSearchOption {
  value: string
  name: string
  sku: string
  stock: number
  model?: string
  category_name?: string
  brand_name?: string
  image_url?: string
}

export interface ProductSearchSelectorProps {
  value?: string
  searchText?: string
  onChange?: (productId: string | undefined, option?: ProductSearchOption | null) => void
  onSelectProduct?: (productId: string | undefined, option?: ProductSearchOption | null) => void
  onSearchTextChange?: (text: string) => void
  onPressEnter?: (text: string) => void
  onClear?: () => void
  placeholder?: string
  label?: React.ReactNode
  showClear?: boolean
  size?: 'large' | 'middle' | 'small'
  style?: React.CSSProperties
  className?: string
}

export const ProductSearchSelector: React.FC<ProductSearchSelectorProps> = ({
  value,
  searchText: controlledSearchText,
  onChange,
  onSelectProduct,
  onSearchTextChange,
  onPressEnter,
  onClear,
  placeholder,
  label = 'Select Product',
  showClear = true,
  size = 'large',
  style,
  className,
}) => {
  const [internalText, setInternalText] = useState('')
  const [options, setOptions] = useState<Array<{ value: string; label: React.ReactNode; raw: ProductSearchOption }>>([])
  const [loading, setLoading] = useState(false)
  const isSelectingRef = useRef(false)
  const searchTimeoutRef = useRef<any>(null)

  const currentText = controlledSearchText !== undefined ? controlledSearchText : internalText

  useEffect(() => {
    if (controlledSearchText !== undefined) {
      setInternalText(controlledSearchText)
    }
  }, [controlledSearchText])

  const handleFetchOptions = (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    if (!query || query.trim().length === 0) {
      setOptions([])
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiClient.get(`/products?search=${encodeURIComponent(query.trim())}&page_size=20`)
        const items = res.data.data || []
        const opts = items.map((p: any) => {
          const stock = Number(p.total_stock || 0)
          const primarySku = p.sku || (p.variants?.[0]?.sku) || ''
          const rawOpt: ProductSearchOption = {
            value: p.id,
            name: p.name,
            sku: primarySku,
            stock,
            model: p.model,
            category_name: p.category?.name || p.category_name || '',
            brand_name: p.brand?.name || p.brand_name || '',
            image_url: p.primary_image_url || p.images?.[0]?.file_url || p.image_url || undefined,
          }
          return {
            value: p.id,
            raw: rawOpt,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
                  {p.model && <span style={{ marginLeft: 8, color: '#64748b', fontSize: '12px' }}>({p.model})</span>}
                  {(rawOpt.category_name || rawOpt.brand_name) && (
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {[rawOpt.brand_name, rawOpt.category_name].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </div>
                <Space size={6}>
                  <Tag
                    color={stock > 0 ? 'green' : 'default'}
                    style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}
                  >
                    {stock > 0 ? `${stock} in store` : '0 units'}
                  </Tag>
                  {primarySku && (
                    <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>
                      {primarySku}
                    </Tag>
                  )}
                </Space>
              </div>
            ),
          }
        })
        setOptions(opts)
      } catch (e) {
        console.error('Failed to search products', e)
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  const handleTextChange = (val: string) => {
    if (isSelectingRef.current) return
    setInternalText(val)
    onSearchTextChange?.(val)
    handleFetchOptions(val)
    if (!val) {
      if (value) {
        onSelectProduct?.(undefined, null)
        onChange?.(undefined, null)
      }
      onClear?.()
    }
  }

  const handleSelect = (val: string, option: any) => {
    isSelectingRef.current = true
    const raw = option?.raw || options.find((o) => o.value === val)?.raw
    if (raw) {
      onSelectProduct?.(raw.value, raw)
      onChange?.(raw.value, raw)
    }
    setInternalText('')
    setOptions([])
    setTimeout(() => {
      isSelectingRef.current = false
      setInternalText('')
    }, 50)
  }

  const handleClear = () => {
    setInternalText('')
    setOptions([])
    onSearchTextChange?.('')
    onSelectProduct?.(undefined, null)
    onChange?.(undefined, null)
    onClear?.()
  }

  const defaultPlaceholder = value
    ? 'Search another product by name, SKU, or model...'
    : 'Search products, SKUs, specifications...'

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontWeight: 700,
            color: '#0f172a',
            fontSize: '14px',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <AutoComplete
          value={currentText}
          options={options}
          onSearch={handleTextChange}
          onSelect={handleSelect}
          popupMatchSelectWidth={false}
          dropdownMatchSelectWidth={false}
          dropdownStyle={{ minWidth: 440, maxWidth: 640 }}
          style={{ flex: 1 }}
        >
          <Input
            size={size}
            allowClear
            placeholder={placeholder || defaultPlaceholder}
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            onPressEnter={() => {
              setOptions([])
              onPressEnter?.(currentText)
            }}
          />
        </AutoComplete>

        {showClear && (value || currentText) && (
          <Button
            icon={<CloseOutlined />}
            onClick={handleClear}
            style={{ color: '#475569', fontWeight: 500 }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
