import React, { useState } from 'react'
import {
  Card,
  Tree,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Typography,
  Space,
  Tag,
  Popconfirm,
  Tooltip,
  message,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, LocationTreeItem } from '../../../api/types'

const { Title, Text } = Typography

export const LocationsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<any | null>(null)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [form] = Form.useForm()

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['locations-tree'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LocationTreeItem[]>>('/locations?format=tree')
      return res.data.data
    },
  })

  const { data: flatLocations } = useQuery({
    queryKey: ['locations-flat'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/locations')
      return res.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingLocation) {
        await apiClient.put(`/locations/${editingLocation.id}`, payload)
      } else {
        await apiClient.post('/locations', payload)
      }
    },
    onSuccess: () => {
      message.success(editingLocation ? 'Location updated' : isDuplicating ? 'Location duplicated' : 'Location created')
      setModalOpen(false)
      setEditingLocation(null)
      setIsDuplicating(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['locations-tree'] })
      queryClient.invalidateQueries({ queryKey: ['locations-flat'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/locations/${id}`)
    },
    onSuccess: () => {
      message.success('Location archived')
      queryClient.invalidateQueries({ queryKey: ['locations-tree'] })
      queryClient.invalidateQueries({ queryKey: ['locations-flat'] })
    },
  })

  const handleOpenModal = (loc?: any) => {
    setEditingLocation(loc || null)
    setIsDuplicating(false)
    if (loc) {
      form.setFieldsValue({
        name: loc.name,
        code: loc.code,
        location_type: loc.location_type || 'other',
        parent_id: loc.parent_id,
        sort_order: loc.sort_order || 0,
        description: loc.description,
      })
    } else {
      form.resetFields()
    }
    setModalOpen(true)
  }

  const handleDuplicate = (loc: any) => {
    setEditingLocation(null)
    setIsDuplicating(true)
    form.setFieldsValue({
      name: `${loc.name} (Copy)`,
      code: loc.code ? `${loc.code}-COPY` : undefined,
      location_type: loc.location_type || 'other',
      parent_id: loc.parent_id,
      sort_order: (loc.sort_order ?? 0) + 1,
      description: loc.description,
    })
    setModalOpen(true)
  }

  const locationTypes = [
    { label: 'Store (Retail Shop)', value: 'store' },
    { label: 'Showroom', value: 'showroom' },
    { label: 'Warehouse', value: 'warehouse' },
    { label: 'Godown', value: 'godown' },
    { label: 'Floor', value: 'floor' },
    { label: 'Section / Zone', value: 'section' },
    { label: 'Rack', value: 'rack' },
    { label: 'Shelf', value: 'shelf' },
    { label: 'Bin', value: 'bin' },
    { label: 'Other', value: 'other' },
  ]

  const renderTreeNodes = (items: LocationTreeItem[]): any[] =>
    items.map((item) => ({
      key: item.id,
      title: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px 0' }}>
          <Space>
            <Text strong>{item.name}</Text>
            {item.code && <Tag color="blue">{item.code}</Tag>}
            <Tag color="purple">{item.location_type}</Tag>
            {!item.is_active && <Tag color="default">Archived</Tag>}
          </Space>
          <Space size={4}>
            <Tooltip title="Duplicate Location">
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
            <Tooltip title="Edit Location">
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
                title="Archive location?"
                onConfirm={(e) => {
                  e?.stopPropagation()
                  archiveMutation.mutate(item.id)
                }}
              >
                <Tooltip title="Archive Location">
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
            Locations & Godowns
          </Title>
          <Text type="secondary">Organize shops, floors, godowns, sections, and racks</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Location
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
          <Text type="secondary">No locations created yet.</Text>
        )}
      </Card>

      <Modal
        title={
          editingLocation
            ? 'Edit Location'
            : isDuplicating
            ? 'Duplicate Location'
            : 'Create Location'
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setIsDuplicating(false)
          setEditingLocation(null)
        }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText={editingLocation ? 'Update' : isDuplicating ? 'Create Duplicate' : 'Create'}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Location Name" name="name" rules={[{ required: true, message: 'Please enter location name' }]}>
            <Input placeholder="e.g. Main Store / Godown 1 / Rack 2" />
          </Form.Item>

          <Form.Item label="Code" name="code">
            <Input placeholder="e.g. STORE-01 / GDN-01" />
          </Form.Item>

          <Form.Item label="Location Type" name="location_type" initialValue="other" rules={[{ required: true }]}>
            <Select options={locationTypes} />
          </Form.Item>

          <Form.Item label="Parent Location (Container)" name="parent_id">
            <Select
              allowClear
              placeholder="None (Top Level Location)"
              options={
                flatLocations
                  ?.filter((l) => !editingLocation || l.id !== editingLocation.id)
                  .map((l) => ({ label: `${l.name} (${l.location_type})`, value: l.id })) || []
              }
            />
          </Form.Item>

          <Form.Item label="Sort Order" name="sort_order" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional address or details" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
