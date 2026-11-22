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
  Upload,
  Alert,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TagsOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileTextOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, Brand } from '../../../api/types'

const { Title, Text } = Typography

export const BrandsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [form] = Form.useForm()

  // Export & Import states
  const [exporting, setExporting] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{
    imported: number
    updated: number
    skipped: number
    errors: string[]
  } | null>(null)

  const handleExportBrands = async () => {
    try {
      setExporting(true)
      const res = await apiClient.get('/brands/export', { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `brands_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('Brands exported successfully')
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Failed to export brands')
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent =
      'name,description,website,is_active\n' +
      'HomeCraft,Premium home decor and furnishings,https://homecraft.example.com,true\n' +
      'Royal Oak,Solid wood designer furniture,https://royaloak.example.com,true\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'brands_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleCommitImport = async () => {
    if (!importFile) {
      message.warning('Please select a CSV file first')
      return
    }
    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await apiClient.post('/brands/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const resultData = res.data.data
      setImportResult(resultData)
      message.success(`Import finished: ${resultData.imported} created, ${resultData.updated} updated`)
      queryClient.invalidateQueries({ queryKey: ['brands-list'] })
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Failed to import brands')
    } finally {
      setImporting(false)
    }
  }

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
        <Space size={12}>
          <Button icon={<DownloadOutlined />} onClick={handleExportBrands} loading={exporting}>
            Export CSV
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => {
              setImportResult(null)
              setImportFile(null)
              setImportModalOpen(true)
            }}
          >
            Import CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add Brand
          </Button>
        </Space>
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

      {/* CSV Import Modal */}
      <Modal
        title={
          <Space>
            <UploadOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 600 }}>Import Brands from CSV</span>
          </Space>
        }
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false)
          setImportFile(null)
          setImportResult(null)
        }}
        footer={[
          <Button
            key="template"
            icon={<FileTextOutlined />}
            onClick={handleDownloadTemplate}
            style={{ float: 'left' }}
          >
            Download Sample CSV
          </Button>,
          <Button
            key="cancel"
            onClick={() => {
              setImportModalOpen(false)
              setImportFile(null)
              setImportResult(null)
            }}
          >
            Close
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<UploadOutlined />}
            loading={importing}
            disabled={!importFile}
            onClick={handleCommitImport}
          >
            Upload & Import
          </Button>,
        ]}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Upload a CSV to quickly bulk-create or update brands in this tenant. Standard columns:{' '}
            <code>name</code>, <code>description</code>, <code>website</code>, <code>is_active</code>.
          </Text>
        </div>

        <Upload.Dragger
          accept=".csv"
          maxCount={1}
          beforeUpload={(file) => {
            setImportFile(file)
            setImportResult(null)
            return false
          }}
          onRemove={() => {
            setImportFile(null)
            setImportResult(null)
          }}
          fileList={importFile ? [importFile as any] : []}
          style={{ padding: '20px 0', marginBottom: 16 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#1677ff', fontSize: 36 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 14, fontWeight: 500 }}>
            Click or drag CSV file to this area to import
          </p>
          <p className="ant-upload-hint" style={{ color: '#94a3b8', fontSize: 12 }}>
            Duplicate names will update existing brand information
          </p>
        </Upload.Dragger>

        {importResult && (
          <Alert
            type={importResult.errors && importResult.errors.length > 0 ? 'warning' : 'success'}
            showIcon
            message={
              importResult.errors && importResult.errors.length > 0
                ? 'Import completed with warnings'
                : 'Brands imported successfully'
            }
            description={
              <div>
                <p style={{ margin: '4px 0' }}>
                  <b>{importResult.imported}</b> brands created, <b>{importResult.updated}</b> updated,{' '}
                  <b>{importResult.skipped}</b> skipped.
                </p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul style={{ paddingLeft: 20, margin: '8px 0 0', maxHeight: 120, overflowY: 'auto' }}>
                    {importResult.errors.map((err, i) => (
                      <li key={i} style={{ color: '#dc2626', fontSize: 12 }}>
                        {err}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            }
            style={{ borderRadius: 8 }}
          />
        )}
      </Modal>
    </div>
  )
}
