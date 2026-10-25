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
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, UnitOfMeasure } from '../../../api/types'

const { Title, Text } = Typography

export const UnitsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null)
  const [form] = Form.useForm()

  const { data: units, isLoading } = useQuery({
    queryKey: ['units-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UnitOfMeasure[]>>('/units')
      return res.data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingUnit) {
        await apiClient.put(`/units/${editingUnit.id}`, payload)
      } else {
        await apiClient.post('/units', payload)
      }
    },
    onSuccess: () => {
      message.success(editingUnit ? 'Unit updated' : 'Unit created')
      setModalOpen(false)
      setEditingUnit(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['units-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/units/${id}`)
    },
    onSuccess: () => {
      message.success('Unit archived')
      queryClient.invalidateQueries({ queryKey: ['units-list'] })
    },
  })

  const handleOpenModal = (unit?: UnitOfMeasure) => {
    setEditingUnit(unit || null)
    if (unit) {
      form.setFieldsValue(unit)
    } else {
      form.resetFields()
    }
    setModalOpen(true)
  }

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <Text strong>{n}</Text>,
    },
    {
      title: 'Decimal Places',
      dataIndex: 'decimal_places',
      key: 'decimal_places',
      render: (dp: number) => <Tag>{dp} decimal(s)</Tag>,
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
      render: (_: any, record: UnitOfMeasure) => (
        <Space size={8}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          {record.is_active && (
            <Popconfirm title="Archive unit?" onConfirm={() => archiveMutation.mutate(record.id)}>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Units of Measure
          </Title>
          <Text type="secondary">Define measurement units (Pieces, Boxes, Meters, Kilograms...)</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Unit
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={units || []} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      <Modal
        title={editingUnit ? 'Edit Unit' : 'Create Unit'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Unit Code" name="code" rules={[{ required: true, message: 'Please enter code (e.g. PC, KG)' }]}>
            <Input placeholder="e.g. PC / BOX / MTR" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item label="Unit Name" name="name" rules={[{ required: true, message: 'Please enter unit name' }]}>
            <Input placeholder="e.g. Piece / Box / Meter" />
          </Form.Item>
          <Form.Item label="Decimal Places (0 for discrete units, 2-3 for weight/length)" name="decimal_places" initialValue={0}>
            <InputNumber min={0} max={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
