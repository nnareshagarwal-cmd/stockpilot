import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Typography,
  Space,
  Tag,
  Popconfirm,
  message,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PercentageOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, TaxRate } from '../../../api/types'

const { Title, Text } = Typography

export const TaxRatesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | null>(null)
  const [form] = Form.useForm()

  const { data: taxRates, isLoading } = useQuery({
    queryKey: ['tax-rates-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<TaxRate[]>>('/tax-rates')
      return res.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingTaxRate) {
        await apiClient.put(`/tax-rates/${editingTaxRate.id}`, payload)
      } else {
        await apiClient.post('/tax-rates', payload)
      }
    },
    onSuccess: () => {
      message.success(editingTaxRate ? 'Tax rate updated' : 'Tax rate created')
      setModalOpen(false)
      setEditingTaxRate(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['tax-rates-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tax-rates/${id}`)
    },
    onSuccess: () => {
      message.success('Tax rate archived')
      queryClient.invalidateQueries({ queryKey: ['tax-rates-list'] })
    },
  })

  const handleOpenModal = (rate?: TaxRate) => {
    setEditingTaxRate(rate || null)
    if (rate) {
      form.setFieldsValue(rate)
    } else {
      form.resetFields()
      form.setFieldsValue({ rate: 18.0 })
    }
    setModalOpen(true)
  }

  const columns = [
    {
      title: 'Tax Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Rate (%)',
      dataIndex: 'rate',
      key: 'rate',
      render: (r: number) => <Tag color="blue">{r}%</Tag>,
    },
    {
      title: 'HSN Code',
      dataIndex: 'hsn_code',
      key: 'hsn_code',
      render: (h: string) => h || '—',
    },
    {
      title: 'SAC Code',
      dataIndex: 'sac_code',
      key: 'sac_code',
      render: (s: string) => s || '—',
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
      render: (_: any, record: TaxRate) => (
        <Space size={8}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {record.is_active && (
            <Popconfirm title="Archive tax rate?" onConfirm={() => archiveMutation.mutate(record.id)}>
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
            Tax Rates & GST Slabs
          </Title>
          <Text type="secondary">Define tax percentages and HSN/SAC classifications for billing</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Tax Rate
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={taxRates || []} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      <Modal
        title={editingTaxRate ? 'Edit Tax Rate' : 'Create Tax Rate'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Tax Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. GST 18% / Exempt" />
          </Form.Item>
          <Form.Item label="Percentage Rate (%)" name="rate" rules={[{ required: true, message: 'Please enter rate' }]}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="HSN Code" name="hsn_code">
            <Input placeholder="e.g. 9403 for furniture" />
          </Form.Item>
          <Form.Item label="SAC Code" name="sac_code">
            <Input placeholder="Optional service accounting code" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional details" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
