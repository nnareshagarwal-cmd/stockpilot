import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Table,
  Button,
  Input,
  Modal,
  Form,
  InputNumber,
  Switch,
  Space,
  Tag,
  Typography,
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Row,
  Col,
  Empty,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  AppstoreOutlined,
  SkinOutlined,
  BlockOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  TagOutlined,
  SettingOutlined,
  PercentageOutlined,
} from '@ant-design/icons'
import { lovApi, LovItem, LovSummaryItem } from '../../../api/lov'

const { Title, Text, Paragraph } = Typography

// Preset module groupings for lookups
interface LookupDefinition {
  category: string
  label: string
  module: string
  usedIn: string
  icon: React.ReactNode
  description: string
}

const LOOKUP_REGISTRY: LookupDefinition[] = [
  // Products & Catalogue
  {
    category: 'unit',
    label: 'Unit of Measure',
    module: 'Products & Catalogue',
    usedIn: 'Product Form > Variants (Pcs, Set, etc.)',
    icon: <AppstoreOutlined style={{ color: '#2563eb' }} />,
    description: 'Units used for product inventory, pricing, and orders.',
  },
  {
    category: 'color_finish',
    label: 'Color & Finish',
    module: 'Products & Catalogue',
    usedIn: 'Product Form > Technical Specs',
    icon: <SkinOutlined style={{ color: '#d97706' }} />,
    description: 'Surface finishes, stains, polish tones, and colorways.',
  },
  {
    category: 'primary_material',
    label: 'Primary Material',
    module: 'Products & Catalogue',
    usedIn: 'Product Form > Technical Specs',
    icon: <BlockOutlined style={{ color: '#059669' }} />,
    description: 'Core construction materials such as woods, fabrics, and metals.',
  },
  {
    category: 'storage_included',
    label: 'Storage Included',
    module: 'Products & Catalogue',
    usedIn: 'Product Form > Technical Specs',
    icon: <InboxOutlined style={{ color: '#7c3aed' }} />,
    description: 'Storage configurations for beds, sofas, wardrobes, and tables.',
  },
  {
    category: 'wood_type',
    label: 'Wood Type',
    module: 'Products & Catalogue',
    usedIn: 'Product Form > Technical Specs',
    icon: <BlockOutlined style={{ color: '#b45309' }} />,
    description: 'Types of solid woods used in furniture manufacturing.',
  },
  {
    category: 'seating_capacity',
    label: 'Seating Capacity',
    module: 'Products & Catalogue',
    usedIn: 'Product Form > Technical Specs',
    icon: <AppstoreOutlined style={{ color: '#0891b2' }} />,
    description: 'Number of seats (e.g. 1 Seater, 3 Seater, 6 Seater Dining).',
  },

  // Inventory & Stock
  {
    category: 'stock_condition',
    label: 'Stock Condition',
    module: 'Inventory & Stock',
    usedIn: 'Stock Balances, Stock Transfers & Stock Mapping',
    icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
    description: 'Sellable and non-sellable physical condition classifications.',
  },
  {
    category: 'adjustment_reason',
    label: 'Adjustment Reason',
    module: 'Inventory & Stock',
    usedIn: 'Stock Adjustments & Reconciliation',
    icon: <SettingOutlined style={{ color: '#dc2626' }} />,
    description: 'Reason codes for manual inventory count changes and write-offs.',
  },
  {
    category: 'location_type',
    label: 'Location Type',
    module: 'Inventory & Stock',
    usedIn: 'Locations & Warehouses hierarchy',
    icon: <FolderOutlined style={{ color: '#4b5563' }} />,
    description: 'Physical location classifications (Showroom, Godown, Floor, Rack).',
  },

  // Purchases & Billing
  {
    category: 'payment_method',
    label: 'Payment Method',
    module: 'Purchases & Billing',
    usedIn: 'Customer Invoices & Supplier Payments',
    icon: <DollarOutlined style={{ color: '#0284c7' }} />,
    description: 'Accepted payment methods (Cash, UPI, Card, Net Banking).',
  },
  {
    category: 'order_status',
    label: 'Order Status',
    module: 'Purchases & Billing',
    usedIn: 'Sales Invoices & Purchase Orders',
    icon: <TagOutlined style={{ color: '#9333ea' }} />,
    description: 'Lifecycle stages for orders and dispatches.',
  },
  {
    category: 'tax_rate',
    label: 'Tax Rates & GST',
    module: 'Purchases & Billing',
    usedIn: 'Product Form > GST Tax Rates & Billing',
    icon: <PercentageOutlined style={{ color: '#059669' }} />,
    description: 'GST tax slabs and rates (e.g. GST 0%, 5%, 12%, 18%, 28%, Exempt).',
  },
]

export const LookupMasterPage: React.FC = () => {
  // Navigation & Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('color_finish')
  const [navSearch, setNavSearch] = useState<string>('')
  const [tableSearch, setTableSearch] = useState<string>('')

  // Data State
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [items, setItems] = useState<LovItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editingItem, setEditingItem] = useState<LovItem | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [form] = Form.useForm()

  // New Category Modal State
  const [newCatModalOpen, setNewCatModalOpen] = useState<boolean>(false)
  const [newCatForm] = Form.useForm()
  const [customLookups, setCustomLookups] = useState<LookupDefinition[]>([])

  // 1. Fetch LOV Summary (counts per category)
  const fetchSummary = async () => {
    try {
      const data = await lovApi.getSummary()
      const counts: Record<string, number> = {}
      data.forEach((s) => {
        counts[s.category] = s.total_count
      })
      setSummary(counts)
    } catch (e) {
      console.error('Failed to load LOV summary', e)
    }
  }

  // 2. Fetch Items for the currently selected category
  const fetchCategoryItems = async (cat: string) => {
    setLoading(true)
    try {
      const data = await lovApi.getItems(cat)
      setItems(data)
    } catch (e) {
      message.error('Failed to load lookup items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      fetchCategoryItems(selectedCategory)
    }
  }, [selectedCategory])

  // Combine standard and custom lookup definitions
  const allLookups = useMemo(() => {
    return [...LOOKUP_REGISTRY, ...customLookups]
  }, [customLookups])

  // Group lookups by Module for the sidebar
  const groupedLookups = useMemo(() => {
    const q = navSearch.trim().toLowerCase()
    const filtered = allLookups.filter(
      (l) => l.label.toLowerCase().includes(q) || l.category.toLowerCase().includes(q)
    )

    const groups: Record<string, LookupDefinition[]> = {}
    filtered.forEach((l) => {
      if (!groups[l.module]) {
        groups[l.module] = []
      }
      groups[l.module].push(l)
    })
    return groups
  }, [allLookups, navSearch])

  const currentLookup = useMemo(() => {
    return allLookups.find((l) => l.category === selectedCategory) || {
      category: selectedCategory,
      label: selectedCategory.replace(/_/g, ' ').toUpperCase(),
      module: 'General Lookups',
      usedIn: 'Forms & Dropdowns',
      icon: <FolderOutlined />,
      description: 'List of values for this category.',
    }
  }, [allLookups, selectedCategory])

  // Filter table items based on tableSearch
  const filteredTableItems = useMemo(() => {
    const q = tableSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    )
  }, [items, tableSearch])

  // Open Add / Edit Modal
  const handleOpenAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({
      category: selectedCategory,
      sort_order: items.length + 1,
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleOpenEdit = (item: LovItem) => {
    setEditingItem(item)
    form.resetFields()
    form.setFieldsValue({
      label: item.label,
      value: item.value,
      sort_order: item.sort_order,
      description: item.description,
      is_active: item.is_active,
    })
    setModalOpen(true)
  }

  // Handle Form Submission
  const handleSaveItem = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      if (editingItem) {
        await lovApi.updateItem(editingItem.id, {
          label: values.label.trim(),
          value: values.value?.trim() || values.label.trim(),
          sort_order: Number(values.sort_order || 0),
          description: values.description?.trim(),
          is_active: values.is_active,
        })
        message.success(`Updated "${values.label}"`)
      } else {
        await lovApi.createItem({
          category: selectedCategory,
          label: values.label.trim(),
          value: values.value?.trim() || values.label.trim(),
          sort_order: Number(values.sort_order || 0),
          description: values.description?.trim(),
        })
        message.success(`Added "${values.label}" to ${currentLookup.label}`)
      }

      setModalOpen(false)
      fetchCategoryItems(selectedCategory)
      fetchSummary()
    } catch (e: any) {
      if (e.errorFields) return
      message.error(e.response?.data?.detail || 'Failed to save lookup value')
    } finally {
      setSaving(false)
    }
  }

  // Handle Archive / Delete
  const handleArchive = async (id: string, label: string) => {
    try {
      await lovApi.archiveItem(id)
      message.success(`Archived "${label}"`)
      fetchCategoryItems(selectedCategory)
      fetchSummary()
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Failed to archive item')
    }
  }

  // Handle Quick Toggle Active
  const handleToggleActive = async (item: LovItem, checked: boolean) => {
    try {
      await lovApi.updateItem(item.id, { is_active: checked })
      message.success(`${item.label} is now ${checked ? 'Active' : 'Inactive'}`)
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_active: checked } : it))
      )
      fetchSummary()
    } catch (e) {
      message.error('Failed to update status')
    }
  }

  // Handle Add Custom Category
  const handleAddCustomCategory = async () => {
    try {
      const values = await newCatForm.validateFields()
      const rawCode = values.category.trim().toLowerCase().replace(/\s+/g, '_')
      const newDef: LookupDefinition = {
        category: rawCode,
        label: values.label.trim(),
        module: values.module || 'Custom Lookups',
        usedIn: 'Custom Dropdown',
        icon: <FolderOutlined style={{ color: '#0284c7' }} />,
        description: values.description || 'Custom dropdown values.',
      }
      setCustomLookups((prev) => [...prev, newDef])
      setSelectedCategory(rawCode)
      setNewCatModalOpen(false)
      newCatForm.resetFields()
      message.success(`Created dropdown category "${values.label}"`)
    } catch (e) {
      // form error
    }
  }

  const columns = [
    {
      title: '#',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 70,
      align: 'center' as const,
      render: (so: number, _: any, idx: number) => (
        <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
          {so !== undefined && so !== null ? so : idx + 1}
        </span>
      ),
    },
    {
      title: 'Value / Display Label',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, record: LovItem) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
            {label}
          </div>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Code / Slug',
      dataIndex: 'value',
      key: 'value',
      width: 220,
      render: (val: string) => (
        <Tag
          color="default"
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            color: '#334155',
          }}
        >
          {val}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 140,
      render: (isActive: boolean, record: LovItem) => (
        <Space size={8}>
          <Switch
            size="small"
            checked={isActive}
            onChange={(checked) => handleToggleActive(record, checked)}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#16a34a' : '#94a3b8' }}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: LovItem) => (
        <Space size={6}>
          <Tooltip title="Edit Value">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#0284c7' }} />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Archive Value">
            <Popconfirm
              title={`Archive "${record.label}"?`}
              description="This value will be deactivated and hidden from dropdown lists."
              onConfirm={() => handleArchive(record.id, record.label)}
              okText="Archive"
              cancelText="Cancel"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '0px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
            Lookup Master
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Centralized management of all dynamic dropdown values across the application. Changes take effect live immediately.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            fetchSummary()
            fetchCategoryItems(selectedCategory)
          }}
        >
          Refresh
        </Button>
      </div>

      {/* Main Two-Column Layout */}
      <Row gutter={[16, 16]}>
        {/* Left Navigation Panel: Modules and Dropdown Categories */}
        <Col xs={24} md={8} lg={7}>
          <Card
            style={{
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
            bodyStyle={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            {/* Search filter for dropdowns */}
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Filter dropdowns..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                allowClear
                size="middle"
              />
            </div>

            {/* Grouped Category Items */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
              {Object.keys(groupedLookups).length === 0 ? (
                <Empty description="No matching dropdowns" style={{ margin: '30px 0' }} />
              ) : (
                Object.entries(groupedLookups).map(([moduleName, lookups]) => (
                  <div key={moduleName} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '4px 8px',
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{moduleName}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                        {lookups.length}
                      </span>
                    </div>

                    {lookups.map((item) => {
                      const isSelected = selectedCategory === item.category
                      const count = summary[item.category] || 0
                      return (
                        <div
                          key={item.category}
                          onClick={() => setSelectedCategory(item.category)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '9px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginBottom: '3px',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc'
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
                          }}
                        >
                          <Space size={8} style={{ overflow: 'hidden' }}>
                            <span style={{ fontSize: '15px' }}>{item.icon}</span>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: isSelected ? 700 : 500,
                                color: isSelected ? '#1d4ed8' : '#1e293b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.label}
                            </span>
                          </Space>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isSelected ? '#2563eb' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#64748b',
                              padding: '1px 7px',
                              borderRadius: '10px',
                            }}
                          >
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Bottom Add Custom Dropdown Button */}
            <Divider style={{ margin: '12px 0' }} />
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => {
                newCatForm.resetFields()
                setNewCatModalOpen(true)
              }}
              style={{ color: '#0284c7', borderColor: '#bae6fd' }}
            >
              + Add Custom Dropdown
            </Button>
          </Card>
        </Col>

        {/* Right Details Panel: Values Table */}
        <Col xs={24} md={16} lg={17}>
          <Card
            style={{
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            {/* Header Bar of the Selected Lookup */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '20px' }}>{currentLookup.icon}</span>
                  <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
                    {currentLookup.label}
                  </Title>
                  <Tag color="blue" style={{ fontWeight: 600, borderRadius: 12, padding: '0 8px' }}>
                    {items.length} values
                  </Tag>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
                  {currentLookup.description} •{' '}
                  <span style={{ color: '#0284c7', fontWeight: 600 }}>{currentLookup.usedIn}</span>
                </div>
              </div>

              <Space size={10}>
                <Input
                  placeholder="Search in this dropdown..."
                  prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  allowClear
                  style={{ width: 220 }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleOpenAdd}
                  style={{ background: '#2563eb' }}
                >
                  + Add New Value
                </Button>
              </Space>
            </div>

            {/* Values Table */}
            <Table
              columns={columns}
              dataSource={filteredTableItems}
              rowKey="id"
              loading={loading}
              pagination={items.length > 20 ? { pageSize: 20 } : false}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      <div style={{ padding: '24px 0' }}>
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>
                          No values in this dropdown yet
                        </div>
                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: 4 }}>
                          Click "+ Add New Value" to define options for {currentLookup.label}.
                        </div>
                      </div>
                    }
                  />
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Modal: Add / Edit Lookup Value */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '18px' }}>{currentLookup.icon}</span>
            <span>
              {editingItem ? `Edit "${editingItem.label}"` : `Add Value to ${currentLookup.label}`}
            </span>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingItem(null)
          form.resetFields()
        }}
        onOk={handleSaveItem}
        confirmLoading={saving}
        okText={editingItem ? 'Save Changes' : 'Add Value'}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* Display Label */}
          <Form.Item
            name="label"
            label="Display Label"
            rules={[
              { required: true, message: 'Please enter a display label' },
              { min: 1, message: 'Label cannot be empty' },
            ]}
          >
            <Input
              placeholder="e.g. Walnut Finish, Sheesham Wood, Pieces (pcs)..."
              size="large"
              onChange={(e) => {
                if (!editingItem) {
                  // Auto-generate slug/code if empty
                  const val = e.target.value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '')
                  form.setFieldsValue({ value: val })
                }
              }}
            />
          </Form.Item>

          {/* Value / Slug Code */}
          <Form.Item
            name="value"
            label="Code / Slug (Optional, for database storing)"
            tooltip="Internal system code. Defaults to the display label if left blank."
          >
            <Input placeholder="e.g. walnut_finish, sheesham_wood, pcs" />
          </Form.Item>

          {/* Sort Order */}
          <Form.Item
            name="sort_order"
            label="Sort Order / Sequence Number"
            tooltip="Controls order in the dropdown (1 appears first, then 2, etc.)"
          >
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>

          {/* Description */}
          <Form.Item name="description" label="Notes / Description (Optional)">
            <Input.TextArea rows={2} placeholder="Brief explanation or usage note..." />
          </Form.Item>

          {/* Active status */}
          <Form.Item name="is_active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Add Custom Dropdown Category */}
      <Modal
        title="Add New Custom Dropdown"
        open={newCatModalOpen}
        onCancel={() => {
          setNewCatModalOpen(false)
          newCatForm.resetFields()
        }}
        onOk={handleAddCustomCategory}
        okText="Create Dropdown"
        destroyOnClose
        width={480}
      >
        <Form form={newCatForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Dropdown Name"
            rules={[{ required: true, message: 'Please enter dropdown name' }]}
          >
            <Input placeholder="e.g. Warranty Period, Cushion Firmness..." size="large" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category Key (Unique Identifier)"
            rules={[{ required: true, message: 'Please enter category code' }]}
          >
            <Input placeholder="e.g. warranty_period, cushion_firmness" />
          </Form.Item>

          <Form.Item
            name="module"
            label="Belongs to Module"
            initialValue="Products & Catalogue"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. Products & Catalogue, Inventory & Stock..." />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="What is this dropdown used for?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default LookupMasterPage
