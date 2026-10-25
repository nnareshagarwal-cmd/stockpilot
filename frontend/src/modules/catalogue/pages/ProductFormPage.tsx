import React, { useState, useEffect, useMemo } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Typography,
  Space,
  Table,
  Divider,
  Upload,
  message,
  Row,
  Col,
  Checkbox,
  TreeSelect,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, AttributeDefinition } from '../../../api/types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

// Component to render single_choice dropdown with an inline "+ Add New Value" feature
const DynamicChoiceSelect: React.FC<{
  attrDef: AttributeDefinition
  value?: string
  onChange?: (val: string) => void
  onAddOption: (attrDef: AttributeDefinition, newLabel: string) => Promise<string | undefined>
}> = ({ attrDef, value, onChange, onAddOption }) => {
  const [newOptionInput, setNewOptionInput] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!newOptionInput.trim()) return
    setAdding(true)
    try {
      const addedOptionId = await onAddOption(attrDef, newOptionInput.trim())
      setNewOptionInput('')
      if (addedOptionId && onChange) {
        onChange(addedOptionId)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <Select
      placeholder={`Select ${attrDef.name}`}
      allowClear
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
      }
      value={value}
      onChange={onChange}
      options={attrDef.options?.map((o) => ({ label: o.value, value: o.id })) || []}
      dropdownRender={(menu) => (
        <>
          {menu}
          <Divider style={{ margin: '8px 0' }} />
          <Space style={{ padding: '0 8px 6px', width: '100%' }}>
            <Input
              size="small"
              placeholder={`+ Add new ${attrDef.name}`}
              value={newOptionInput}
              onChange={(e) => setNewOptionInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              style={{ width: '180px' }}
            />
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              loading={adding}
              onClick={handleAdd}
            >
              Add
            </Button>
          </Space>
        </>
      )}
    />
  )
}

export const ProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null)

  const [variants, setVariants] = useState<any[]>([
    {
      key: '1',
      sku: '',
      variant_name: '',
      barcode: '',
      unit_id: null,
      purchase_price: 0,
      selling_price: 0,
      mrp: null,
      reorder_point: 0,
      reorder_quantity: 0,
    },
  ])
  const [fileList, setFileList] = useState<any[]>([])

  // Fetch master data: categories, brands, units, tax rates, locations
  const { data: categories } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/categories')
      return res.data.data
    },
  })

  const { data: brands } = useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/brands')
      return res.data.data
    },
  })

  const { data: units } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/units')
      return res.data.data
    },
  })

  const { data: taxRates } = useQuery({
    queryKey: ['tax-rates-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/tax-rates')
      return res.data.data
    },
  })

  // Locations tree for hierarchical Floor / Godown selection
  const { data: rawLocationTree } = useQuery({
    queryKey: ['locations-tree'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/locations?format=tree')
      return res.data.data
    },
  })

  // Dynamic attributes query based on selected category
  const { data: attributes } = useQuery({
    queryKey: ['attributes-by-category', selectedCategoryId],
    queryFn: async () => {
      const url = selectedCategoryId ? `/attributes?category_id=${selectedCategoryId}` : '/attributes'
      const res = await apiClient.get<ApiResponse<AttributeDefinition[]>>(url)
      return res.data.data
    },
  })

  // Filter Categories: Main Categories (parent_id IS NULL) and Sub Categories
  const mainCategories = useMemo(() => {
    return categories?.filter((c: any) => !c.parent_id && c.is_active !== false) || []
  }, [categories])

  const subCategories = useMemo(() => {
    if (!selectedCategoryId) return []
    return categories?.filter((c: any) => c.parent_id === selectedCategoryId && c.is_active !== false) || []
  }, [categories, selectedCategoryId])

  // Units from Lookup Master
  const filteredUnits = useMemo(() => {
    return (
      units?.filter((u: any) => u.is_active !== false) || []
    )
  }, [units])

  // Default Unit ID (PCS preferred)
  const defaultUnitId = useMemo(() => {
    const pcs = filteredUnits.find(
      (u: any) => u.code?.toLowerCase() === 'pcs' || u.name?.toLowerCase().includes('piece')
    )
    return pcs ? pcs.id : filteredUnits[0]?.id || null
  }, [filteredUnits])

  // Set default unit for initial variant when units are loaded
  useEffect(() => {
    if (defaultUnitId && variants.length === 1 && !variants[0].unit_id) {
      setVariants((prev) => [{ ...prev[0], unit_id: defaultUnitId }])
    }
  }, [defaultUnitId])

  // Helper to compute auto-generated SKU based on Category + Subcategory + sequence
  const computeSku = (catId?: string | null, subCatId?: string | null, index: number = 0) => {
    const cat = categories?.find((c: any) => c.id === catId)
    const sub = categories?.find((c: any) => c.id === subCatId)

    const catCode = (cat?.code || cat?.name || 'GEN')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase()

    const subCode = sub
      ? (sub.code || sub.name || '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 3)
          .toUpperCase()
      : 'ALL'

    const seq = String(index + 1).padStart(3, '0')
    return `${catCode}-${subCode}-${seq}`
  }

  // Auto-generate SKUs for variants
  const handleAutoGenerateSku = (catId?: string | null, subCatId?: string | null) => {
    if (!catId) return
    setVariants((prev) =>
      prev.map((v, idx) => {
        // Only overwrite if empty or matches auto-generated dash pattern
        if (!v.sku || !v.sku.trim() || v.sku.includes('-')) {
          return { ...v, sku: computeSku(catId, subCatId, idx) }
        }
        return v
      })
    )
  }

  // Build tree data for Floor / Godown Location mapped to attribute option IDs
  const locationTreeData = useMemo(() => {
    if (!rawLocationTree) return []

    // Find the assigned_location attribute definition
    const locAttr = attributes?.find(
      (a) => a.code === 'assigned_location' || a.name.toLowerCase().includes('location')
    )
    const options = locAttr?.options || []

    const mapTree = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        // Clean location display title
        const cleanName = node.name.replace(/\[.*?\]/g, '').trim()

        // Match option id in attribute definition
        const matchedOpt = options.find((o) => {
          const optVal = o.value.toLowerCase()
          return (
            (node.code && optVal.includes(node.code.toLowerCase())) ||
            optVal.includes(cleanName.toLowerCase()) ||
            optVal.includes(node.name.toLowerCase())
          )
        })

        const mappedNode: any = {
          title: cleanName,
          value: matchedOpt ? matchedOpt.id : node.id,
          key: node.id,
        }

        if (node.children && node.children.length > 0) {
          mappedNode.children = mapTree(node.children)
        }
        return mappedNode
      })
    }

    return mapTree(rawLocationTree)
  }, [rawLocationTree, attributes])

  // Load existing product if editing
  const { data: existingProduct } = useQuery({
    queryKey: ['product-edit', id],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/products/${id}`)
      return res.data.data
    },
    enabled: isEdit,
  })

  useEffect(() => {
    if (existingProduct) {
      form.setFieldsValue({
        name: existingProduct.name,
        description: existingProduct.description,
        category_id: existingProduct.category_id,
        subcategory_id: existingProduct.subcategory_id,
        brand_id: existingProduct.brand_id,
        model: existingProduct.model,
        tax_rate_id: existingProduct.tax_rate_id,
      })
      setSelectedCategoryId(existingProduct.category_id)
      setSelectedSubcategoryId(existingProduct.subcategory_id)

      if (existingProduct.variants && existingProduct.variants.length > 0) {
        setVariants(
          existingProduct.variants.map((v: any, idx: number) => ({
            key: v.id || String(idx),
            id: v.id,
            sku: v.sku,
            variant_name: v.variant_name,
            barcode: v.barcode,
            unit_id: v.unit_id,
            purchase_price: Number(v.purchase_price || 0),
            selling_price: Number(v.selling_price || 0),
            mrp: v.mrp ? Number(v.mrp) : null,
            reorder_point: Number(v.reorder_point || 0),
            reorder_quantity: Number(v.reorder_quantity || 0),
          }))
        )
      }

      // Populate attribute form values
      if (existingProduct.attributes) {
        const attrValues: any = {}
        existingProduct.attributes.forEach((attr: any) => {
          if (attr.text_value !== null) attrValues[`attr_${attr.attribute_id}`] = attr.text_value
          else if (attr.numeric_value !== null) attrValues[`attr_${attr.attribute_id}`] = attr.numeric_value
          else if (attr.decimal_value !== null) attrValues[`attr_${attr.attribute_id}`] = attr.decimal_value
          else if (attr.boolean_value !== null) attrValues[`attr_${attr.attribute_id}`] = attr.boolean_value
          else if (attr.option_id !== null) attrValues[`attr_${attr.attribute_id}`] = attr.option_id
        })
        form.setFieldsValue(attrValues)
      }
    }
  }, [existingProduct, form])

  // Save product mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEdit) {
        const res = await apiClient.put(`/products/${id}`, payload)
        return res.data.data
      } else {
        const res = await apiClient.post('/products', payload)
        return res.data.data
      }
    },
    onSuccess: async (product) => {
      // If there are files to upload, upload them
      if (fileList.length > 0 && !isEdit) {
        const formData = new FormData()
        fileList.forEach((file) => {
          if (file.originFileObj) {
            formData.append('files', file.originFileObj)
          }
        })
        try {
          await apiClient.post(`/products/${product.id}/images`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch {
          message.warning('Product saved, but some images failed to upload')
        }
      }

      message.success(isEdit ? 'Product updated successfully' : 'Product created successfully')
      navigate(`/products/${product.id}`)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to save product'
      message.error(msg)
    },
  })

  // Inline handler to add a new LOV / Attribute Option dynamically
  const handleAddNewOption = async (attrDef: AttributeDefinition, newLabel: string) => {
    try {
      const cat = attrDef.code || 'general'
      const res = await apiClient.post<ApiResponse<any>>('/lov', {
        category: cat,
        label: newLabel,
        value: newLabel,
      })
      message.success(`Added "${newLabel}" to ${attrDef.name}`)
      await queryClient.invalidateQueries({ queryKey: ['attributes-by-category'] })
      return res.data.data?.option_id
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to add option'
      message.error(msg)
      return undefined
    }
  }

  const handleAddVariant = () => {
    const nextIndex = variants.length
    const autoSku = selectedCategoryId
      ? computeSku(selectedCategoryId, selectedSubcategoryId, nextIndex)
      : ''

    setVariants([
      ...variants,
      {
        key: Date.now().toString(),
        sku: autoSku,
        variant_name: '',
        barcode: '',
        unit_id: defaultUnitId || null,
        purchase_price: 0,
        selling_price: 0,
        mrp: null,
        reorder_point: 0,
        reorder_quantity: 0,
      },
    ])
  }

  const handleRemoveVariant = (key: string) => {
    if (variants.length <= 1) {
      message.warning('At least one SKU variant is required')
      return
    }
    setVariants(variants.filter((v) => v.key !== key))
  }

  const handleVariantChange = (key: string, field: string, value: any) => {
    setVariants(
      variants.map((v) => {
        if (v.key === key) {
          return { ...v, [field]: value }
        }
        return v
      })
    )
  }

  const onFinish = (values: any) => {
    // Validate variants have SKUs
    for (const v of variants) {
      if (!v.sku || !v.sku.trim()) {
        message.error('All variants must have a valid SKU')
        return
      }
    }

    // Format attributes
    const formattedAttrs: any[] = []
    if (attributes) {
      attributes.forEach((attrDef) => {
        const val = values[`attr_${attrDef.id}`]
        if (val !== undefined && val !== null && val !== '') {
          const item: any = { attribute_id: attrDef.id }
          if (attrDef.data_type === 'decimal' || attrDef.data_type === 'number') {
            item.decimal_value = Number(val)
          } else if (attrDef.data_type === 'boolean') {
            item.boolean_value = Boolean(val)
          } else if (attrDef.data_type === 'single_choice') {
            item.option_id = val
          } else {
            item.text_value = String(val)
          }
          formattedAttrs.push(item)
        }
      })
    }

    const payload = {
      name: values.name,
      description: values.description,
      category_id: values.category_id || null,
      subcategory_id: values.subcategory_id || null,
      brand_id: values.brand_id || null,
      model: values.model || null,
      tax_rate_id: values.tax_rate_id || null,
      variants: variants.map((v) => ({
        id: v.id || undefined,
        sku: v.sku.trim(),
        variant_name: v.variant_name || null,
        barcode: v.barcode || null,
        unit_id: v.unit_id || null,
        purchase_price: Number(v.purchase_price || 0),
        selling_price: Number(v.selling_price || 0),
        mrp: v.mrp ? Number(v.mrp) : null,
        reorder_point: Number(v.reorder_point || 0),
        reorder_quantity: Number(v.reorder_quantity || 0),
      })),
      attributes: formattedAttrs,
    }

    saveMutation.mutate(payload)
  }

  // Variant Columns:
  // SKU | Variant Name | Barcode | Unit | Purchase Price (₹) | MRP (₹) | Discount Price (₹) * | Actions
  const variantColumns = [
    {
      title: (
        <Space direction="horizontal" size={4}>
          <span>SKU *</span>
          <Tooltip title="Auto-generate SKU based on Category & Subcategory">
            <Button
              type="text"
              size="small"
              icon={<ThunderboltOutlined style={{ color: '#1677ff' }} />}
              onClick={() => handleAutoGenerateSku(selectedCategoryId, selectedSubcategoryId)}
            />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'sku',
      key: 'sku',
      width: 180,
      render: (_: any, record: any, index: number) => (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="e.g. BED-KNG-001"
            value={record.sku}
            onChange={(e) => handleVariantChange(record.key, 'sku', e.target.value)}
          />
          <Tooltip title="Regenerate SKU">
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => {
                const auto = computeSku(selectedCategoryId, selectedSubcategoryId, index)
                handleVariantChange(record.key, 'sku', auto)
              }}
            />
          </Tooltip>
        </Space.Compact>
      ),
    },
    {
      title: 'Variant Name',
      dataIndex: 'variant_name',
      key: 'variant_name',
      render: (_: any, record: any) => (
        <Input
          placeholder="e.g. King Size / Teak Finish"
          value={record.variant_name}
          onChange={(e) => handleVariantChange(record.key, 'variant_name', e.target.value)}
        />
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit_id',
      key: 'unit_id',
      width: 140,
      render: (_: any, record: any) => (
        <Select
          placeholder="Select Unit"
          value={record.unit_id}
          onChange={(val) => handleVariantChange(record.key, 'unit_id', val)}
          options={filteredUnits.map((u: any) => ({
            label: `${u.name} (${u.code})`,
            value: u.id,
          }))}
        />
      ),
    },
    {
      title: 'Purchase Price (₹)',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      width: 145,
      render: (_: any, record: any) => (
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          placeholder="Purchase Price"
          value={record.purchase_price}
          onChange={(val) => handleVariantChange(record.key, 'purchase_price', val || 0)}
        />
      ),
    },
    {
      title: 'MRP (₹)',
      dataIndex: 'mrp',
      key: 'mrp',
      width: 140,
      render: (_: any, record: any) => (
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          placeholder="MRP"
          value={record.mrp}
          onChange={(val) => handleVariantChange(record.key, 'mrp', val)}
        />
      ),
    },
    {
      title: 'Discount Price (₹) *',
      dataIndex: 'selling_price',
      key: 'selling_price',
      width: 155,
      render: (_: any, record: any) => (
        <InputNumber
          min={0}
          precision={2}
          style={{ width: '100%' }}
          placeholder="Discount Price"
          value={record.selling_price}
          onChange={(val) => handleVariantChange(record.key, 'selling_price', val || 0)}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveVariant(record.key)}
        />
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')} />
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </Title>
          <Text type="secondary">Define basic information, SKU variants, specifications, and images</Text>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* Section 1: Basic Information */}
        <Card title="1. Basic Information" style={{ borderRadius: '12px', marginBottom: '24px' }}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                label="Product Name"
                name="name"
                rules={[{ required: true, message: 'Please enter product name' }]}
              >
                <Input placeholder="e.g. Three-Seater Velvet Luxury Sofa / King Size Bed" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Model / Series" name="model">
                <Input placeholder="e.g. Royal Comfort 210" size="large" />
              </Form.Item>
            </Col>
          </Row>

          {/* Category & Dependent Sub Category */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Main Category"
                name="category_id"
                rules={[{ required: true, message: 'Please select main category' }]}
              >
                <Select
                  placeholder="Select Main Category (e.g. Balcony & Garden, Bedroom Furniture)"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                  onChange={(val) => {
                    setSelectedCategoryId(val)
                    setSelectedSubcategoryId(null)
                    form.setFieldValue('subcategory_id', undefined)
                    handleAutoGenerateSku(val, null)
                  }}
                  options={mainCategories.map((c: any) => ({ label: c.name, value: c.id }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Sub Category" name="subcategory_id">
                <Select
                  placeholder={selectedCategoryId ? 'Select Sub Category' : 'Select Main Category first'}
                  disabled={!selectedCategoryId}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                  onChange={(val) => {
                    setSelectedSubcategoryId(val)
                    handleAutoGenerateSku(selectedCategoryId, val)
                  }}
                  options={subCategories.map((c: any) => ({ label: c.name, value: c.id }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Brand (Type Ahead) & Tax Rate */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Brand" name="brand_id">
                <Select
                  placeholder="Search or select brand (Type to filter)"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                  options={brands?.map((b: any) => ({ label: b.name, value: b.id })) || []}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Tax Rate (GST)" name="tax_rate_id">
                <Select
                  placeholder="Select Tax Rate"
                  allowClear
                  options={
                    taxRates?.map((t: any) => ({
                      label: `${t.name} (${t.rate}%)`,
                      value: t.id,
                    })) || []
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Description" name="description">
            <TextArea rows={3} placeholder="Detailed product specifications, features, or notes..." />
          </Form.Item>
        </Card>

        {/* Section 2: SKU Variants & Pricing */}
        <Card
          title="2. SKU Variants & Pricing"
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddVariant}>
              Add Another Variant
            </Button>
          }
          style={{ borderRadius: '12px', marginBottom: '24px' }}
        >
          <Table
            columns={variantColumns}
            dataSource={variants}
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
          />
        </Card>

        {/* Section 3: Technical Specifications & Dynamic LOVs */}
        {attributes && attributes.length > 0 && (
          <Card
            title={`3. Specifications (${selectedCategoryId ? 'Category Specifics' : 'Global Attributes'})`}
            style={{ borderRadius: '12px', marginBottom: '24px' }}
          >
            <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
              These specifications power dynamic search filters. You can also add new custom options directly from each dropdown.
            </Paragraph>
            <Row gutter={16}>
              {attributes
                .filter(
                  (attrDef) =>
                    attrDef.code !== 'assigned_location' &&
                    !attrDef.name.toLowerCase().includes('location') &&
                    !attrDef.name.toLowerCase().includes('godown')
                )
                .map((attrDef) => {
                  return (
                    <Col xs={24} sm={12} md={8} key={attrDef.id}>
                      {attrDef.data_type === 'single_choice' ? (
                        <Form.Item
                          label={attrDef.name}
                          name={`attr_${attrDef.id}`}
                          rules={[{ required: attrDef.is_required, message: `Please select ${attrDef.name}` }]}
                        >
                          <DynamicChoiceSelect
                            attrDef={attrDef}
                            onAddOption={handleAddNewOption}
                          />
                        </Form.Item>
                      ) : attrDef.data_type === 'boolean' ? (
                      <Form.Item
                        name={`attr_${attrDef.id}`}
                        valuePropName="checked"
                        style={{ marginTop: '30px' }}
                      >
                        <Checkbox>{attrDef.name}</Checkbox>
                      </Form.Item>
                    ) : attrDef.data_type === 'decimal' || attrDef.data_type === 'number' ? (
                      <Form.Item
                        label={`${attrDef.name} ${attrDef.unit_label ? `(${attrDef.unit_label})` : ''}`}
                        name={`attr_${attrDef.id}`}
                        rules={[{ required: attrDef.is_required, message: `Please enter ${attrDef.name}` }]}
                      >
                        <InputNumber style={{ width: '100%' }} placeholder="e.g. 18, 210" />
                      </Form.Item>
                    ) : (
                      <Form.Item
                        label={attrDef.name}
                        name={`attr_${attrDef.id}`}
                        rules={[{ required: attrDef.is_required, message: `Please enter ${attrDef.name}` }]}
                      >
                        <Input placeholder={`Enter ${attrDef.name}`} />
                      </Form.Item>
                    )}
                  </Col>
                )
              })}
            </Row>
          </Card>
        )}

        {/* Section 4: Product Images (Initial create only) */}
        {!isEdit && (
          <Card title="4. Product Images" style={{ borderRadius: '12px', marginBottom: '24px' }}>
            <Upload
              listType="picture-card"
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              beforeUpload={() => false}
              multiple
              accept="image/png, image/jpeg, image/webp"
            >
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>Upload Photos</div>
              </div>
            </Upload>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
              Supported: PNG, JPEG, WebP up to 10MB each. The first uploaded image will default as primary.
            </Text>
          </Card>
        )}

        {/* Submit Actions */}
        <div style={{ textAlign: 'right' }}>
          <Space size={16}>
            <Button size="large" onClick={() => navigate('/products')}>
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
            >
              {isEdit ? 'Update Product' : 'Save Product'}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  )
}
