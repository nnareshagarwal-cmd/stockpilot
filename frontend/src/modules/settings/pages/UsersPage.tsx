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
  Checkbox,
  Divider,
  Popconfirm,
  message,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  MobileOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse } from '../../../api/types'

const { Title, Text } = Typography

interface MobileTileDef {
  id: string
  label: string
  description: string
}

const DEFAULT_MOBILE_TILES: MobileTileDef[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Quick KPIs & low stock' },
  { id: 'search', label: 'Product Search & Stock Check', description: 'Global search & stock' },
  { id: 'products', label: 'Products', description: 'Catalogue browse' },
  { id: 'stock_maintenance', label: 'Stock Maintenance', description: 'Stock In / Out / Adjust' },
  { id: 'stock_transfers', label: 'Stock Transfers', description: 'Move between locations' },
  { id: 'supplier_orders', label: 'Supplier Orders', description: 'View & receive orders' },
]

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

  const { data: tileDefs } = useQuery({
    queryKey: ['mobile-tiles'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MobileTileDef[]>>('/mobile/tiles')
      return res.data.data
    },
  })

  const tiles = tileDefs && tileDefs.length > 0 ? tileDefs : DEFAULT_MOBILE_TILES

  const buildMobilePagesPayload = (selectedIds: string[] | undefined) => {
    const selectedSet = new Set(selectedIds || [])
    const map: Record<string, boolean> = {}
    tiles.forEach((t) => {
      map[t.id] = selectedSet.has(t.id)
    })
    return map
  }

  const createMutation = useMutation({
    mutationFn: async (val: any) => {
      const payload: any = {
        full_name: val.full_name,
        email: val.email,
        password: val.password,
        phone: val.phone || undefined,
        role_name: val.role_name,
        mobile_access: !!val.mobile_access,
        mobile_pages: buildMobilePagesPayload(val.mobile_tile_ids),
      }
      if (val.mobile_pin && val.mobile_pin.trim()) {
        payload.mobile_pin = val.mobile_pin.trim()
      }
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
    mutationFn: async ({ userId, val }: { userId: string; val: any }) => {
      const payload: any = {
        full_name: val.full_name,
        phone: val.phone ?? '',
        role_name: val.role_name,
        is_active: val.is_active,
        mobile_access: !!val.mobile_access,
        mobile_pages: buildMobilePagesPayload(val.mobile_tile_ids),
      }
      if (val.mobile_pin && val.mobile_pin.trim()) {
        payload.mobile_pin = val.mobile_pin.trim()
      }
      await apiClient.put(`/users/${userId}`, payload)
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

  const unlockMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.post(`/users/${userId}/unlock-pin`)
    },
    onSuccess: () => {
      message.success('Mobile PIN unlocked')
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      if (selectedUser) {
        setSelectedUser({ ...selectedUser, is_pin_locked: false, pin_failed_attempts: 0 })
      }
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to unlock PIN')
    },
  })

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user)
    const enabledTileIds = tiles
      .filter((t) => user.mobile_pages && user.mobile_pages[t.id])
      .map((t) => t.id)

    editForm.setFieldsValue({
      full_name: user.full_name,
      phone: user.phone,
      role_name: user.role,
      is_active: user.is_active,
      mobile_access: !!user.mobile_access,
      mobile_pin: '',
      mobile_tile_ids: enabledTileIds,
    })
    setEditModalOpen(true)
  }

  const renderTileCheckboxes = (targetForm: any) => (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          Mobile App Tiles Allowed
        </Text>
        <Space size={6}>
          <Button
            size="small"
            onClick={() => targetForm.setFieldValue('mobile_tile_ids', tiles.map((t) => t.id))}
          >
            Select All
          </Button>
          <Button size="small" onClick={() => targetForm.setFieldValue('mobile_tile_ids', [])}>
            Clear All
          </Button>
        </Space>
      </div>
      <Form.Item name="mobile_tile_ids" style={{ marginBottom: 0 }}>
        <Checkbox.Group style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {tiles.map((t) => (
              <Checkbox key={t.id} value={t.id}>
                <span style={{ fontSize: 13 }}>{t.label}</span>
              </Checkbox>
            ))}
          </div>
        </Checkbox.Group>
      </Form.Item>
    </div>
  )

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Email / Phone',
      key: 'contact',
      render: (_: any, record: any) => (
        <div>
          <div>
            <Text copyable>{record.email}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.phone || 'No phone'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'blue' : 'geekblue'}>{role?.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Mobile PWA',
      key: 'mobile_access',
      render: (_: any, record: any) => {
        const enabledCount = Object.values(record.mobile_pages || {}).filter(Boolean).length
        return (
          <Space size={4} wrap>
            <Tag icon={<MobileOutlined />} color={record.mobile_access ? 'cyan' : 'default'}>
              {record.mobile_access ? `Enabled (${enabledCount} tiles)` : 'Off'}
            </Tag>
            {record.mobile_access && !record.has_mobile_pin && <Tag color="warning">No PIN</Tag>}
            {record.is_pin_locked && (
              <Tag icon={<LockOutlined />} color="error">
                Locked
              </Tag>
            )}
          </Space>
        )
      },
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
      width: 170,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleOpenEdit(record)}
          >
            Edit
          </Button>
          {record.is_pin_locked && (
            <Popconfirm
              title="Unlock mobile PIN?"
              description="Reset failed attempt counter so this user can sign in immediately."
              onConfirm={() => unlockMutation.mutate(record.id)}
              okText="Unlock"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<UnlockOutlined />}
                loading={unlockMutation.isPending}
              >
                Unlock
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            User Management &amp; Mobile Access
          </Title>
          <Text type="secondary">
            Manage shop members, 4-digit mobile PINs, account locks, and mobile tile visibility
          </Text>
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
        width={620}
      >
        <Form form={form} layout="vertical" onFinish={(val) => createMutation.mutate(val)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Full Name" name="full_name" rules={[{ required: true, message: 'Please enter name' }]}>
              <Input placeholder="e.g. Suresh Kumar" />
            </Form.Item>
            <Form.Item label="Phone Number" name="phone">
              <Input placeholder="10-digit mobile for PIN login" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
              <Input placeholder="suresh@example.com" />
            </Form.Item>
            <Form.Item label="Initial Web Password" name="password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]}>
              <Input.Password placeholder="Min 6 characters" />
            </Form.Item>
          </div>
          <Form.Item label="Role" name="role_name" initialValue="staff" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Staff (Products, Stock, Sales)', value: 'staff' },
                { label: 'Administrator (Full Shop Access)', value: 'admin' },
              ]}
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }}>Mobile PWA Settings</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Mobile App Access" name="mobile_access" valuePropName="checked" initialValue={false}>
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            </Form.Item>
            <Form.Item
              label="4-Digit Mobile PIN"
              name="mobile_pin"
              rules={[{ pattern: /^\d{4}$/, message: 'PIN must be exactly 4 digits' }]}
            >
              <Input.Password maxLength={4} inputMode="numeric" placeholder="e.g. 1234" />
            </Form.Item>
          </div>
          {renderTileCheckboxes(form)}
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title={`Update User${selectedUser ? `: ${selectedUser.full_name}` : ''}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={620}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(val) => {
            if (selectedUser) {
              updateMutation.mutate({ userId: selectedUser.id, val })
            }
          }}
        >
          {selectedUser?.is_pin_locked && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 14,
              }}
            >
              <Text type="danger" strong>
                <LockOutlined /> Mobile PIN is locked (5 failed attempts)
              </Text>
              <Button
                size="small"
                danger
                type="primary"
                icon={<UnlockOutlined />}
                loading={unlockMutation.isPending}
                onClick={() => unlockMutation.mutate(selectedUser.id)}
              >
                Unlock Now
              </Button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Full Name" name="full_name">
              <Input />
            </Form.Item>
            <Form.Item label="Phone" name="phone">
              <Input placeholder="Mobile number for PIN login" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Role" name="role_name" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: 'Staff (Products, Stock, Sales)', value: 'staff' },
                  { label: 'Administrator (Full Shop Access)', value: 'admin' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Account Status" name="is_active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>

          <Divider style={{ margin: '12px 0' }}>Mobile PWA Settings</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item label="Mobile App Access" name="mobile_access" valuePropName="checked">
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            </Form.Item>
            <Form.Item
              label={selectedUser?.has_mobile_pin ? 'Reset 4-Digit PIN (leave blank to keep)' : 'Set 4-Digit Mobile PIN'}
              name="mobile_pin"
              rules={[{ pattern: /^\d{4}$/, message: 'PIN must be exactly 4 digits' }]}
            >
              <Input.Password maxLength={4} inputMode="numeric" placeholder="Enter 4 digits" />
            </Form.Item>
          </div>
          {renderTileCheckboxes(editForm)}
        </Form>
      </Modal>
    </div>
  )
}
