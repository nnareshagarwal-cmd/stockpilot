import React, { useState, useMemo } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  Space,
  Tag,
  Popconfirm,
  message,
  Divider,
  Tabs,
  Row,
  Col,
  Alert,
  Checkbox,
  Empty,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  ApartmentOutlined,
  SettingOutlined,
  LinkOutlined,
  DisconnectOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, AttributeDefinition, CategoryAttributeMapping } from '../../../api/types'

const { Title, Text, Paragraph } = Typography

export const AttributesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('mapping')

  // Category & Subcategory selection for Mapping Tab
  const [selectedMainCatId, setSelectedMainCatId] = useState<string | null>(null)
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null)

  // Modals state
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [selectedAttrIdsToLink, setSelectedAttrIdsToLink] = useState<string[]>([])
  const [filterSearch, setFilterSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AttributeDefinition | null>(null)
  const [dataType, setDataType] = useState<string>('text')
  const [form] = Form.useForm()

  // Queries
  const { data: attributes, isLoading: isAttrsLoading } = useQuery({
    queryKey: ['attributes-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AttributeDefinition[]>>('/attributes')
      return res.data.data
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['categories-flat'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/categories')
      return res.data.data
    },
  })

  // Group Categories into Main and Subcategories
  const mainCategories = useMemo(() => {
    return categories?.filter((c) => !c.parent_id && c.is_active !== false) || []
  }, [categories])

  // Auto-select first main category if none selected
  React.useEffect(() => {
    if (!selectedMainCatId && mainCategories.length > 0) {
      setSelectedMainCatId(mainCategories[0].id)
    }
  }, [mainCategories, selectedMainCatId])

  const subCategories = useMemo(() => {
    if (!selectedMainCatId) return []
    return categories?.filter((c) => c.parent_id === selectedMainCatId && c.is_active !== false) || []
  }, [categories, selectedMainCatId])

  // Active Category ID for mapping
  const activeCategoryId = selectedSubCatId || selectedMainCatId

  // Selected Category objects for UI badges
  const selectedMainCat = useMemo(() => {
    return categories?.find((c) => c.id === selectedMainCatId)
  }, [categories, selectedMainCatId])

  const selectedSubCat = useMemo(() => {
    return categories?.find((c) => c.id === selectedSubCatId)
  }, [categories, selectedSubCatId])

  // Query category specifications mapping
  const { data: categoryMappings, isLoading: isMappingsLoading } = useQuery({
    queryKey: ['category-attribute-mappings', activeCategoryId],
    queryFn: async () => {
      if (!activeCategoryId) return []
      const res = await apiClient.get<ApiResponse<CategoryAttributeMapping[]>>(
        `/categories/${activeCategoryId}/attributes`
      )
      return res.data.data
    },
    enabled: Boolean(activeCategoryId),
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingAttr) {
        await apiClient.put(`/attributes/${editingAttr.id}`, payload)
      } else {
        await apiClient.post('/attributes', payload)
      }
    },
    onSuccess: () => {
      message.success(editingAttr ? 'Attribute updated' : 'Attribute created')
      setModalOpen(false)
      setEditingAttr(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['attributes-list'] })
      queryClient.invalidateQueries({ queryKey: ['category-attribute-mappings'] })
    },
    onError: (err: any) => {
      const detail =
        err.response?.data?.error?.message ||
        (typeof err.response?.data?.detail === 'string'
          ? err.response?.data?.detail
          : err.response?.data?.detail?.[0]?.msg) ||
        err.message ||
        'Action failed'
      message.error(detail)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/attributes/${id}`)
    },
    onSuccess: () => {
      message.success('Attribute archived')
      queryClient.invalidateQueries({ queryKey: ['attributes-list'] })
      queryClient.invalidateQueries({ queryKey: ['category-attribute-mappings'] })
    },
  })

  const syncMappingsMutation = useMutation({
    mutationFn: async ({ categoryId, attributeIds }: { categoryId: string; attributeIds: string[] }) => {
      await apiClient.post(`/categories/${categoryId}/attributes`, { attribute_ids: attributeIds })
    },
    onSuccess: () => {
      message.success('Category specifications updated successfully')
      setLinkModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['category-attribute-mappings', activeCategoryId] })
      queryClient.invalidateQueries({ queryKey: ['attributes-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to update mappings')
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: async ({ categoryId, attributeId }: { categoryId: string; attributeId: string }) => {
      await apiClient.delete(`/categories/${categoryId}/attributes/${attributeId}`)
    },
    onSuccess: () => {
      message.success('Specification unlinked from category')
      queryClient.invalidateQueries({ queryKey: ['category-attribute-mappings'] })
      queryClient.invalidateQueries({ queryKey: ['attributes-by-category'] })
      queryClient.invalidateQueries({ queryKey: ['attributes-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to unlink specification')
    },
  })

  // Open Link Modal
  const handleOpenLinkModal = () => {
    // Pre-populate with currently directly mapped attribute IDs
    const directIds = categoryMappings
      ?.filter((m) => !m.is_inherited)
      .map((m) => m.attribute_id) || []
    setSelectedAttrIdsToLink(directIds)
    setFilterSearch('')
    setLinkModalOpen(true)
  }

  // Handle Create / Edit Attribute Modal
  const handleOpenModal = (attr?: AttributeDefinition) => {
    setEditingAttr(attr || null)
    if (attr) {
      setDataType(attr.data_type)
      const mappedCats: string[] =
        attr.category_ids && attr.category_ids.length > 0
          ? attr.category_ids
          : attr.category_id
          ? [attr.category_id]
          : []
      form.setFieldsValue({
        name: attr.name,
        code: attr.code,
        data_type: attr.data_type,
        category_ids: mappedCats,
        is_required: attr.is_required,
        is_searchable: attr.is_searchable,
        is_filterable: attr.is_filterable,
        unit_label: attr.unit_label,
        description: attr.description,
        sort_order: attr.sort_order,
        options: attr.options?.map((o) => ({ value: o.value })) || [],
      })
    } else {
      form.resetFields()
      setDataType('text')
      form.setFieldsValue({
        data_type: 'text',
        is_searchable: true,
        sort_order: 0,
        options: [],
        category_ids: activeCategoryId ? [activeCategoryId] : [],
      })
    }
    setModalOpen(true)
  }

  // Filter available attributes for linking modal
  const filteredAvailableAttrs = useMemo(() => {
    if (!attributes) return []
    if (!filterSearch) return attributes
    const q = filterSearch.toLowerCase()
    return attributes.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.data_type.toLowerCase().includes(q)
    )
  }, [attributes, filterSearch])

  // Category Mappings Table Columns
  const mappingColumns = [
    {
      title: 'Technical Specification',
      dataIndex: 'attribute_name',
      key: 'name',
      render: (name: string, record: CategoryAttributeMapping) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong style={{ fontSize: '15px' }}>{name}</Text>
            {record.unit_label && <Tag color="blue">{record.unit_label}</Tag>}
          </Space>
          <Text type="secondary" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            Code: {record.attribute_code}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Data Type',
      dataIndex: 'data_type',
      key: 'data_type',
      width: 160,
      render: (dt: string) => {
        const colorMap: Record<string, string> = {
          single_choice: 'purple',
          multiple_choice: 'magenta',
          number: 'geekblue',
          decimal: 'cyan',
          boolean: 'orange',
          text: 'default',
        }
        return <Tag color={colorMap[dt] || 'blue'}>{dt.replace('_', ' ').toUpperCase()}</Tag>
      },
    },
    {
      title: 'Assignment Scope',
      key: 'scope',
      width: 260,
      render: (_: any, record: CategoryAttributeMapping) => {
        if (record.is_inherited) {
          return (
            <Tooltip title={`Inherited from parent category '${record.inherited_from_category_name}'. All subcategories share this.`}>
              <Tag color="cyan" icon={<CheckCircleFilled />}>
                Inherited from {record.inherited_from_category_name}
              </Tag>
            </Tooltip>
          )
        }
        return (
          <Tag color="green" icon={<CheckCircleFilled />}>
            Directly Linked to {selectedSubCat ? selectedSubCat.name : selectedMainCat?.name}
          </Tag>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: CategoryAttributeMapping) => {
        if (record.is_inherited) {
          return (
            <Tooltip title="Inherited from Main Category. To unlink, switch to Main Category view.">
              <Button type="text" disabled icon={<InfoCircleOutlined />} size="small">
                Parent Spec
              </Button>
            </Tooltip>
          )
        }
        return (
          <Popconfirm
            title="Unlink specification from this category?"
            description="The specification will no longer appear when creating products in this category."
            okText="Unlink"
            cancelText="Cancel"
            onConfirm={() =>
              unlinkMutation.mutate({
                categoryId: activeCategoryId!,
                attributeId: record.attribute_id,
              })
            }
          >
            <Button
              type="text"
              danger
              icon={<DisconnectOutlined />}
              size="small"
              loading={unlinkMutation.isPending}
            >
              Unlink
            </Button>
          </Popconfirm>
        )
      },
    },
  ]

  // Master Attribute Definitions Columns
  const masterColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AttributeDefinition) => (
        <Space>
          <Text strong>{name}</Text>
          {record.unit_label && <Tag>{record.unit_label}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (c: string) => <Tag color="blue">{c}</Tag>,
    },
    {
      title: 'Data Type',
      dataIndex: 'data_type',
      key: 'data_type',
      render: (dt: string) => <Tag color="purple">{dt}</Tag>,
    },
    {
      title: 'Mapped Categories',
      key: 'categories',
      render: (_: any, record: AttributeDefinition) => {
        const catIds = record.category_ids || []
        if (catIds.length === 0 && !record.category_id) {
          return <Tag color="cyan">Global (All Categories)</Tag>
        }
        const matched = categories?.filter((c) => catIds.includes(c.id) || c.id === record.category_id) || []
        return (
          <Space wrap size={[4, 4]}>
            {matched.slice(0, 3).map((c) => (
              <Tag key={c.id} color="blue">
                {c.name}
              </Tag>
            ))}
            {matched.length > 3 && <Tag>+{matched.length - 3} more</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Options',
      key: 'options',
      render: (_: any, r: AttributeDefinition) =>
        r.options && r.options.length > 0 ? (
          <Text style={{ fontSize: '12px' }}>
            {r.options.map((o) => o.value).join(', ')}
          </Text>
        ) : (
          '—'
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: AttributeDefinition) => (
        <Space size={8}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {record.is_active && (
            <Popconfirm title="Archive attribute?" onConfirm={() => archiveMutation.mutate(record.id)}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const dataTypes = [
    { label: 'Single Choice (Dropdown LOV)', value: 'single_choice' },
    { label: 'Number (Integer)', value: 'number' },
    { label: 'Decimal', value: 'decimal' },
    { label: 'Text', value: 'text' },
    { label: 'Boolean (Yes/No)', value: 'boolean' },
    { label: 'Date', value: 'date' },
    { label: 'Multiple Choice', value: 'multiple_choice' },
  ]

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Category Specifications & Technical Attributes
          </Title>
          <Text type="secondary">
            Configure which technical specifications apply to each category and subcategory
          </Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            New Specification
          </Button>
          {activeTab === 'mapping' && (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={handleOpenLinkModal}
              disabled={!activeCategoryId}
            >
              Link Specifications
            </Button>
          )}
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k)}
        items={[
          {
            key: 'mapping',
            label: (
              <Space>
                <ApartmentOutlined />
                <span>Category & Subcategory Mapping</span>
              </Space>
            ),
            children: (
              <div>
                {/* Step 1: Category & Subcategory Selection Card */}
                <Card style={{ borderRadius: '12px', marginBottom: '20px' }}>
                  <Row gutter={[24, 16]} align="middle">
                    <Col xs={24} md={10}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '13px' }}>
                        1. Select Main Category:
                      </Text>
                      <Select
                        size="large"
                        style={{ width: '100%' }}
                        placeholder="Select Main Category"
                        value={selectedMainCatId}
                        onChange={(val) => {
                          setSelectedMainCatId(val)
                          setSelectedSubCatId(null) // reset subcategory
                        }}
                        options={mainCategories.map((c) => ({
                          label: c.name,
                          value: c.id,
                        }))}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>

                    <Col xs={24} md={14}>
                      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: '13px' }}>
                        2. Scope Level (Main Category or Subcategory):
                      </Text>
                      <Select
                        size="large"
                        style={{ width: '100%' }}
                        placeholder="Select Scope / Subcategory"
                        value={selectedSubCatId || 'ALL'}
                        onChange={(val) => {
                          setSelectedSubCatId(val === 'ALL' ? null : val)
                        }}
                        options={[
                          {
                            label: `★ Main Category Level: ${selectedMainCat?.name || ''} (All Subcategories Inherit)`,
                            value: 'ALL',
                          },
                          ...subCategories.map((sub) => ({
                            label: `Subcategory: ${sub.name}`,
                            value: sub.id,
                          })),
                        ]}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Col>
                  </Row>

                  <Divider style={{ margin: '16px 0' }} />

                  {/* Active Context Banner */}
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong style={{ fontSize: '14px' }}>
                            Currently Managing:{' '}
                          </Text>
                          <Tag color="geekblue" style={{ fontSize: '13px', padding: '3px 8px' }}>
                            {selectedMainCat?.name}
                          </Tag>
                          {selectedSubCat && (
                            <>
                              <Text strong style={{ margin: '0 6px' }}>→</Text>
                              <Tag color="purple" style={{ fontSize: '13px', padding: '3px 8px' }}>
                                {selectedSubCat.name} (Subcategory)
                              </Tag>
                            </>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          {selectedSubCat
                            ? `Includes specifications unique to '${selectedSubCat.name}' + inherited from '${selectedMainCat?.name}'.`
                            : `Applies to '${selectedMainCat?.name}' and is automatically inherited by all its subcategories.`}
                        </Text>
                      </div>
                    }
                  />
                </Card>

                {/* Step 2: Linked Specifications Table */}
                <Card
                  title={
                    <Space>
                      <span>Active Technical Specifications</span>
                      <Tag color="blue">{categoryMappings?.length || 0} active</Tag>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        onClick={handleOpenLinkModal}
                        disabled={!activeCategoryId}
                      >
                        Link / Manage Specifications
                      </Button>
                    </Space>
                  }
                  style={{ borderRadius: '12px' }}
                  bodyStyle={{ padding: 0 }}
                >
                  <Table
                    columns={mappingColumns}
                    dataSource={categoryMappings || []}
                    rowKey="attribute_id"
                    loading={isMappingsLoading}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty
                          description="No specifications mapped to this category yet."
                          style={{ padding: '32px 0' }}
                        >
                          <Button
                            type="primary"
                            icon={<LinkOutlined />}
                            onClick={handleOpenLinkModal}
                          >
                            Link Specifications Now
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'definitions',
            label: (
              <Space>
                <SettingOutlined />
                <span>All Master Specifications ({attributes?.length || 0})</span>
              </Space>
            ),
            children: (
              <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
                <Table
                  columns={masterColumns}
                  dataSource={attributes || []}
                  rowKey="id"
                  loading={isAttrsLoading}
                  pagination={{ pageSize: 12 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Modal: Link Specifications to Category */}
      <Modal
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Link Technical Specifications
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Select specifications to link directly to{' '}
              <Text strong style={{ color: '#1677ff' }}>
                {selectedSubCat ? selectedSubCat.name : selectedMainCat?.name}
              </Text>
            </Text>
          </div>
        }
        open={linkModalOpen}
        onCancel={() => setLinkModalOpen(false)}
        onOk={() =>
          syncMappingsMutation.mutate({
            categoryId: activeCategoryId!,
            attributeIds: selectedAttrIdsToLink,
          })
        }
        confirmLoading={syncMappingsMutation.isPending}
        width={720}
        okText={`Save ${selectedAttrIdsToLink.length} Linked Specifications`}
      >
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <Input.Search
            placeholder="Search specifications by name, code, or type (e.g. material, finish, wattage, seating)..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            allowClear
          />
        </div>

        <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '12px' }}>
          {filteredAvailableAttrs.length === 0 ? (
            <Empty description="No matching specifications found" />
          ) : (
            filteredAvailableAttrs.map((attr) => {
              const isChecked = selectedAttrIdsToLink.includes(attr.id)
              return (
                <div
                  key={attr.id}
                  onClick={() => {
                    if (isChecked) {
                      setSelectedAttrIdsToLink((prev) => prev.filter((id) => id !== attr.id))
                    } else {
                      setSelectedAttrIdsToLink((prev) => [...prev, attr.id])
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '6px',
                    backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                    border: isChecked ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Space align="center" size={12}>
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (e.target.checked) {
                          setSelectedAttrIdsToLink((prev) => [...prev, attr.id])
                        } else {
                          setSelectedAttrIdsToLink((prev) => prev.filter((id) => id !== attr.id))
                        }
                      }}
                    />
                    <div>
                      <Space>
                        <Text strong style={{ fontSize: '14px', color: '#0f172a' }}>
                          {attr.name}
                        </Text>
                        {attr.unit_label && <Tag color="blue">{attr.unit_label}</Tag>}
                      </Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          Code: {attr.code}
                        </Text>
                      </div>
                    </div>
                  </Space>

                  <Space>
                    <Tag color="purple">{attr.data_type.replace('_', ' ').toUpperCase()}</Tag>
                  </Space>
                </div>
              )
            })
          )}
        </div>
      </Modal>

      {/* Modal: Create / Edit Attribute */}
      <Modal
        title={editingAttr ? 'Edit Attribute' : 'Create New Specification Attribute'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(val) => {
            const catIds = Array.isArray(val.category_ids)
              ? val.category_ids
              : val.category_ids
              ? [val.category_ids]
              : []
            const payload = {
              ...val,
              category_ids: catIds,
              category_id: catIds.length > 0 ? catIds[0] : null,
              options:
                val.data_type === 'single_choice' || val.data_type === 'multiple_choice'
                  ? (val.options || [])
                      .filter((o: any) => o && o.value && o.value.trim() !== '')
                      .map((o: any, idx: number) => ({
                        value: o.value.trim(),
                        sort_order: idx + 1,
                      }))
                  : [],
            }
            saveMutation.mutate(payload)
          }}
        >
          <Form.Item label="Attribute Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Frame Material / Seating Capacity / Lock Mechanism" />
          </Form.Item>

          <Form.Item label="Attribute Code" name="code" rules={[{ required: true, message: 'Please enter code' }]}>
            <Input placeholder="e.g. frame_material / seating_capacity / lock_mech" />
          </Form.Item>

          <Form.Item label="Data Type" name="data_type" rules={[{ required: true }]}>
            <Select options={dataTypes} onChange={(val) => setDataType(val)} />
          </Form.Item>

          <Form.Item label="Categories (Leave empty for Global)" name="category_ids">
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="Global (Applicable to all categories)"
              optionFilterProp="label"
              maxTagCount="responsive"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={categories?.map((c) => {
                const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null
                return {
                  label: parent ? `${parent.name} → ${c.name}` : c.name,
                  value: c.id,
                }
              }) || []}
            />
          </Form.Item>

          <Form.Item label="Unit Label (Optional)" name="unit_label">
            <Input placeholder="e.g. cm, mm, W, V, kg" />
          </Form.Item>

          <Space size={24} style={{ marginBottom: '16px' }}>
            <Form.Item label="Searchable" name="is_searchable" valuePropName="checked" style={{ margin: 0 }}>
              <Switch defaultChecked />
            </Form.Item>
            <Form.Item label="Filterable" name="is_filterable" valuePropName="checked" style={{ margin: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="Required" name="is_required" valuePropName="checked" style={{ margin: 0 }}>
              <Switch />
            </Form.Item>
          </Space>

          {(dataType === 'single_choice' || dataType === 'multiple_choice') && (
            <>
              <Divider style={{ margin: '16px 0' }}>Dropdown Options (List of Values)</Divider>
              <Form.List name="options">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'value']}
                          rules={[{ required: true, message: 'Option value required' }]}
                        >
                          <Input placeholder="Option value e.g. Solid Wood, Metal, Teak Finish" style={{ width: 340 }} />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ef4444' }} />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        Add Option
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
