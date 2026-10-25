import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Typography,
  Space,
  Tag,
  Popconfirm,
  message,
  Divider,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, AttributeDefinition } from '../../../api/types'

const { Title, Text } = Typography

export const AttributesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AttributeDefinition | null>(null)
  const [dataType, setDataType] = useState<string>('text')
  const [form] = Form.useForm()

  const { data: attributes, isLoading } = useQuery({
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
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Action failed')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/attributes/${id}`)
    },
    onSuccess: () => {
      message.success('Attribute archived')
      queryClient.invalidateQueries({ queryKey: ['attributes-list'] })
    },
  })

  const handleOpenModal = (attr?: AttributeDefinition) => {
    setEditingAttr(attr || null)
    if (attr) {
      setDataType(attr.data_type)
      form.setFieldsValue({
        name: attr.name,
        code: attr.code,
        data_type: attr.data_type,
        category_id: attr.category_id,
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
      })
    }
    setModalOpen(true)
  }

  const columns = [
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
      title: 'Applicable Category',
      dataIndex: 'category_id',
      key: 'category',
      render: (catId: string) => {
        if (!catId) return <Tag color="cyan">Global (All)</Tag>
        const c = categories?.find((x) => x.id === catId)
        return c ? <Tag color="blue">{c.name}</Tag> : '—'
      },
    },
    {
      title: 'Flags',
      key: 'flags',
      render: (_: any, r: AttributeDefinition) => (
        <Space size={4}>
          {r.is_searchable && <Tag color="green">Searchable</Tag>}
          {r.is_required && <Tag color="red">Required</Tag>}
        </Space>
      ),
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
    { label: 'Text', value: 'text' },
    { label: 'Number (Integer)', value: 'number' },
    { label: 'Decimal', value: 'decimal' },
    { label: 'Boolean (Yes/No)', value: 'boolean' },
    { label: 'Date', value: 'date' },
    { label: 'Single Choice (Dropdown)', value: 'single_choice' },
    { label: 'Multiple Choice', value: 'multiple_choice' },
  ]

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Product Specifications & Attributes
          </Title>
          <Text type="secondary">Define typed attributes (dimensions, color, wattage, material...)</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Attribute
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={attributes || []} rowKey="id" loading={isLoading} pagination={{ pageSize: 12 }} />
      </Card>

      <Modal
        title={editingAttr ? 'Edit Attribute' : 'Create Attribute'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Form.Item label="Attribute Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Width / Wattage / Color" />
          </Form.Item>

          <Form.Item label="Attribute Code" name="code" rules={[{ required: true, message: 'Please enter code' }]}>
            <Input placeholder="e.g. width / wattage / color" />
          </Form.Item>

          <Form.Item label="Data Type" name="data_type" rules={[{ required: true }]}>
            <Select options={dataTypes} onChange={(val) => setDataType(val)} />
          </Form.Item>

          <Form.Item label="Category (Leave empty for Global)" name="category_id">
            <Select
              allowClear
              placeholder="Global (Applicable to all categories)"
              options={categories?.map((c) => ({ label: c.name, value: c.id })) || []}
            />
          </Form.Item>

          <Form.Item label="Unit Label" name="unit_label">
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
              <Divider style={{ margin: '16px 0' }}>Dropdown Options</Divider>
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
                          <Input placeholder="Option value e.g. Red, Matte, SS 304" style={{ width: 340 }} />
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
