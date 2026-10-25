import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Typography,
  Space,
  Tag,
  Popconfirm,
  message,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TagsOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, Brand } from '../../../api/types'

const { Title, Text } = Typography

export const BrandsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [form] = Form.useForm()

  const { data: brands, isLoading } = useQuery({
    queryKey: ['brands-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Brand[]>>('/brands')
      return res.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingBrand) {
        await apiClient.put(`/brands/${editingBrand.id}`, payload)
      } else {
        await apiClient.post('/brands', payload)
      }
    },
    onSuccess: () => {
      message.success(editingBrand ? 'Brand updated' : 'Brand created')
      setModalOpen(false)
      setEditingBrand(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['brands-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/brands/${id}`)
    },
    onSuccess: () => {
      message.success('Brand archived')
      queryClient.invalidateQueries({ queryKey: ['brands-list'] })
    },
  })

  const handleOpenModal = (brand?: Brand) => {
    setEditingBrand(brand || null)
    if (brand) {
      form.setFieldsValue(brand)
    } else {
      form.resetFields()
    }
    setModalOpen(true)
  }

  const columns = [
    {
      title: 'Brand Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (d: string) => d || '—',
    },
    {
      title: 'Website',
      dataIndex: 'website',
      key: 'website',
      render: (w: string) => (w ? <a href={w} target="_blank" rel="noreferrer">{w}</a> : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      width: 100,
      render: (act: boolean) => <Tag color={act ? 'green' : 'default'}>{act ? 'Active' : 'Archived'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: Brand) => (
        <Space size={8}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {record.is_active && (
            <Popconfirm title="Archive brand?" onConfirm={() => archiveMutation.mutate(record.id)}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Brands
          </Title>
          <Text type="secondary">Manage manufacturers and product brands</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Brand
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={brands || []} rowKey="id" loading={isLoading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingBrand ? 'Edit Brand' : 'Create Brand'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Brand Name" name="name" rules={[{ required: true, message: 'Please enter brand name' }]}>
            <Input placeholder="e.g. HomeCraft / Philips" />
          </Form.Item>
          <Form.Item label="Website URL" name="website">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
