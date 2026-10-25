import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Space,
  Tag,
  Switch,
  message,
} from 'antd'
import { PlusOutlined, EditOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, UserSummary } from '../../../api/types'

const { Title, Text } = Typography

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/users')
      return res.data.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.post('/users', payload)
    },
    onSuccess: () => {
      message.success('User added successfully')
      setAddModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to add user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      await apiClient.put(`/users/${userId}`, data)
    },
    onSuccess: () => {
      message.success('User updated successfully')
      setEditModalOpen(false)
      setSelectedUser(null)
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to update user')
    },
  })

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user)
    editForm.setFieldsValue({
      full_name: user.full_name,
      phone: user.phone,
      role_name: user.role,
      is_active: user.is_active,
    })
    setEditModalOpen(true)
  }

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => <Text copyable>{email}</Text>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (p: string) => p || '—',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'blue' : 'geekblue'}>
          {role?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (act: boolean) => (
        <Tag color={act ? 'green' : 'default'}>{act ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: any) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          size="small"
          onClick={() => handleOpenEdit(record)}
        >
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            User Management
          </Title>
          <Text type="secondary">Manage shop members and assign administrative or operational roles</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          Add User
        </Button>
      </div>

      <Card style={{ borderRadius: '12px' }} bodyStyle={{ padding: 0 }}>
        <Table columns={columns} dataSource={users || []} rowKey="id" loading={isLoading} pagination={false} />
      </Card>

      {/* Add User Modal */}
      <Modal
        title="Add User to Business"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(val) => createMutation.mutate(val)}>
          <Form.Item label="Full Name" name="full_name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="e.g. Suresh Kumar" />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
            <Input placeholder="suresh@example.com" />
          </Form.Item>
          <Form.Item label="Initial Password" name="password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]}>
            <Input.Password placeholder="Temporary password" />
          </Form.Item>
          <Form.Item label="Phone Number" name="phone">
            <Input placeholder="Optional mobile number" />
          </Form.Item>
          <Form.Item label="Role" name="role_name" initialValue="staff" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Staff (Products, Stock, Sales)', value: 'staff' },
                { label: 'Administrator (Full Shop Access)', value: 'admin' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Update User Membership"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(val) => {
            if (selectedUser) {
              updateMutation.mutate({ userId: selectedUser.id, data: val })
            }
          }}
        >
          <Form.Item label="Full Name" name="full_name">
            <Input />
          </Form.Item>
          <Form.Item label="Phone" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="Role" name="role_name" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Staff (Products, Stock, Sales)', value: 'staff' },
                { label: 'Administrator (Full Shop Access)', value: 'admin' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Active Status" name="is_active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
