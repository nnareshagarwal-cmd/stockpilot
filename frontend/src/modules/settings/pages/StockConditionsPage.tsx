import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Typography,
  Space,
  Tag,
  Popconfirm,
  message,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, StockCondition } from '../../../api/types'

const { Title, Text } = Typography

export const StockConditionsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCondition, setEditingCondition] = useState<StockCondition | null>(null)
  const [form] = Form.useForm()

  const { data: conditions, isLoading } = useQuery({
    queryKey: ['stock-conditions-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockCondition[]>>('/stock-conditions')
      return res.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingCondition) {
        await apiClient.put(`/stock-conditions/${editingCondition.id}`, payload)
      } else {
        await apiClient.post('/stock-conditions', payload)
      }
    },
    onSuccess: () => {
      message.success(editingCondition ? 'Stock condition updated' : 'Stock condition created')
      setModalOpen(false)
      setEditingCondition(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['stock-conditions-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/stock-conditions/${id}`)
    },
    onSuccess: () => {
      message.success('Condition archived')
      queryClient.invalidateQueries({ queryKey: ['stock-conditions-list'] })
    },
  })

  const handleOpenModal = (cond?: StockCondition) => {
    setEditingCondition(cond || null)
    if (cond) {
      form.setFieldsValue(cond)
    } else {
      form.resetFields()
      form.setFieldsValue({ is_sellable: true, sort_order: 0 })
    }
    setModalOpen(true)
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Sellable Stock',
      dataIndex: 'is_sellable',
      key: 'is_sellable',
      render: (sellable: boolean) => (
        <Tag color={sellable ? 'green' : 'orange'}>
          {sellable ? 'Yes (Available for Sale)' : 'No (Quarantine / Hold)'}
        </Tag>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (d: string) => d || '—',
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
      render: (_: any, record: StockCondition) => (
        <Space size={8}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {record.is_active && (
            <Popconfirm title="Archive stock condition?" onConfirm={() => archiveMutation.mutate(record.id)}>
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
            Stock Conditions
          </Title>
          <Text type="secondary">Classify inventory conditions (New, Display, Damaged, Under Inspection...)</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Condition
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={conditions || []} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      <Modal
        title={editingCondition ? 'Edit Stock Condition' : 'Create Stock Condition'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Condition Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. New / Sellable" />
          </Form.Item>
          <Form.Item label="Code" name="code" rules={[{ required: true, message: 'Please enter code' }]}>
            <Input placeholder="e.g. new_sellable" />
          </Form.Item>
          <Form.Item label="Sellable (Can be invoiced/billed)" name="is_sellable" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <Form.Item label="Sort Order" name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional details" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
