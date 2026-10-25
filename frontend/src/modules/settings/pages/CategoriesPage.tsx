import React, { useState, useEffect } from 'react'
import {
  Card,
  Tree,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Typography,
  Space,
  Tag,
  Popconfirm,
  Tooltip,
  message,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  HolderOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, CategoryTreeItem } from '../../../api/types'

const { Title, Text } = Typography

export const CategoriesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<any | null>(null)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [form] = Form.useForm()

  // Draggable Modal state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [rel, setRel] = useState({ x: 0, y: 0 })

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only primary click
    setDragging(true)
    setRel({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      setPosition({
        x: e.clientX - rel.x,
        y: e.clientY - rel.y,
      })
    }
    const onMouseUp = () => {
      setDragging(false)
    }

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, rel])

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CategoryTreeItem[]>>('/categories?format=tree')
      return res.data.data
    },
  })

  const { data: flatCategories } = useQuery({
    queryKey: ['categories-flat'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/categories')
      return res.data.data
    },
  })

  // Filter: ONLY top-level (root) categories are selectable as parent
  const parentOptions =
    flatCategories
      ?.filter((c) => !c.parent_id && (!editingCategory || c.id !== editingCategory.id))
      .map((c) => ({
        label: c.name,
        value: c.id,
      })) || []

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingCategory) {
        await apiClient.put(`/categories/${editingCategory.id}`, payload)
      } else {
        await apiClient.post('/categories', payload)
      }
    },
    onSuccess: () => {
      message.success(
        editingCategory
          ? 'Category updated successfully'
          : isDuplicating
          ? 'Category duplicated successfully'
          : 'Category created successfully'
      )
      setModalOpen(false)
      setEditingCategory(null)
      setIsDuplicating(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
      queryClient.invalidateQueries({ queryKey: ['categories-flat'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categories/${id}`)
    },
    onSuccess: () => {
      message.success('Category archived')
      queryClient.invalidateQueries({ queryKey: ['categories-tree'] })
      queryClient.invalidateQueries({ queryKey: ['categories-flat'] })
    },
  })

  const handleOpenModal = (cat?: any) => {
    setEditingCategory(cat || null)
    setIsDuplicating(false)
    setPosition({ x: 0, y: 0 }) // Center position
    if (cat) {
      form.setFieldsValue({
        name: cat.name,
        code: cat.code,
        parent_id: cat.parent_id,
        sort_order: cat.sort_order || 0,
        description: cat.description,
      })
    } else {
      form.resetFields()
    }
    setModalOpen(true)
  }

  const handleDuplicate = (cat: any) => {
    setEditingCategory(null)
    setIsDuplicating(true)
    setPosition({ x: 0, y: 0 }) // Center position
    form.setFieldsValue({
      name: `${cat.name} (Copy)`,
      code: cat.code ? `${cat.code}-COPY` : undefined,
      parent_id: cat.parent_id,
      sort_order: (cat.sort_order ?? 0) + 1,
      description: cat.description,
    })
    setModalOpen(true)
  }

  // Convert categories into Tree format with Duplicate, Edit, and Archive actions
  const renderTreeNodes = (items: CategoryTreeItem[]): any[] =>
    items.map((item) => ({
      key: item.id,
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px 0' }}>
          <Space>
            <Text strong>{item.name}</Text>
            {!item.is_active && <Tag color="default">Archived</Tag>}
          </Space>
          <Space size={4}>
            <Tooltip title="Duplicate Category">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined style={{ color: '#1677ff' }} />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDuplicate(item)
                }}
              />
            </Tooltip>
            <Tooltip title="Edit Category">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenModal(item)
                }}
              />
            </Tooltip>
            {item.is_active && (
              <Popconfirm
                title="Archive category?"
                onConfirm={(e) => {
                  e?.stopPropagation()
                  archiveMutation.mutate(item.id)
                }}
              >
                <Tooltip title="Archive Category">
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        </div>
      ),
      children: item.children ? renderTreeNodes(item.children) : [],
    }))

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Categories
          </Title>
          <Text type="secondary">Manage hierarchical categories for your store and catalogue</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Category
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} loading={isLoading}>
        {treeData && treeData.length > 0 ? (
          <Tree
            showLine
            defaultExpandAll
            treeData={renderTreeNodes(treeData)}
            blockNode
            style={{ fontSize: '15px' }}
          />
        ) : (
          <Text type="secondary">No categories created yet.</Text>
        )}
      </Card>

      <Modal
        title={
          <div
            style={{
              width: '100%',
              cursor: 'move',
              userSelect: 'none',
              padding: '2px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseDown={onMouseDown}
          >
            <Space>
              <HolderOutlined style={{ color: '#94a3b8' }} />
              <span style={{ fontWeight: 600 }}>
                {editingCategory ? 'Edit Category' : isDuplicating ? 'Duplicate Category' : 'Create Category'}
              </span>
            </Space>
            <Tag color="cyan" style={{ fontSize: '11px', margin: 0, cursor: 'move' }}>
              Drag to move
            </Tag>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setIsDuplicating(false)
          setEditingCategory(null)
        }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText={editingCategory ? 'Update' : isDuplicating ? 'Create Duplicate' : 'Create'}
        mask={false}
        maskClosable={false}
        style={{ pointerEvents: 'auto' }}
        modalRender={(modal) => (
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              borderRadius: '8px',
            }}
          >
            {modal}
          </div>
        )}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Category Name" name="name" rules={[{ required: true, message: 'Please enter category name' }]}>
            <Input placeholder="e.g. Dining Sets / 3 Seater Sofas" />
          </Form.Item>

          <Form.Item label="Code" name="code">
            <Input placeholder="e.g. DIN-6S / SOFA-3S" />
          </Form.Item>

          <Form.Item
            label="Parent Category (Top-Level Group)"
            name="parent_id"
            extra="Only top-level categories are shown. Leave empty to create a new top-level category."
          >
            <Select
              showSearch
              allowClear
              placeholder="Search or select top-level category..."
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase().trim())
              }
              options={parentOptions}
            />
          </Form.Item>

          <Form.Item label="Sort Order" name="sort_order" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes or details" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
