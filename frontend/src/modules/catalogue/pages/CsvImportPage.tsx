import React, { useState } from 'react'
import {
  Card,
  Upload,
  Button,
  Typography,
  Table,
  Tag,
  Space,
  Alert,
  message,
  Divider,
} from 'antd'
import {
  InboxOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../../api/client'
import { CsvPreviewResponse } from '../../../api/types'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

export const CsvImportPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<any | null>(null)
  const navigate = useNavigate()

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile)
    setImportSummary(null)
    setLoadingPreview(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await apiClient.post('/products/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(res.data.data)
      message.success('CSV preview loaded')
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to parse CSV preview'
      message.error(msg)
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
    return false // prevent default upload
  }

  const handleCommitImport = async () => {
    if (!file) return
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiClient.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportSummary(res.data.data)
      message.success(`Successfully imported ${res.data.data.imported} products!`)
    } catch (err: any) {
      message.error('CSV import failed')
    } finally {
      setImporting(false)
    }
  }

  const previewColumns = [
    {
      title: 'Row',
      dataIndex: 'row',
      key: 'row',
      width: 60,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (st: string) =>
        st === 'valid' ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Valid
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Error
          </Tag>
        ),
    },
    {
      title: 'Product Name',
      key: 'name',
      render: (_: any, r: any) => r.data.name || '—',
    },
    {
      title: 'SKU',
      key: 'sku',
      render: (_: any, r: any) => <Tag color="blue">{r.data.sku || '—'}</Tag>,
    },
    {
      title: 'Selling Price',
      key: 'selling_price',
      render: (_: any, r: any) => (r.data.selling_price ? `₹${r.data.selling_price}` : '—'),
    },
    {
      title: 'Validation Errors',
      dataIndex: 'errors',
      key: 'errors',
      render: (errs: string[]) =>
        errs && errs.length > 0 ? (
          <Text type="danger" style={{ fontSize: '12px' }}>
            {errs.join(', ')}
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Ready for import
          </Text>
        ),
    },
  ]

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/products')} />
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
            Bulk CSV Product Import
          </Title>
          <Text type="secondary">Upload and validate your bulk product catalogue before committing</Text>
        </div>
      </div>

      {/* Upload Zone */}
      <Card style={{ borderRadius: '12px', marginBottom: '24px' }}>
        <Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={(f) => handleFileSelect(f as File)}
          style={{ padding: '24px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#1677ff', fontSize: '48px' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: '16px', fontWeight: 600 }}>
            Click or drag CSV file to this area to preview
          </p>
          <p className="ant-upload-hint" style={{ color: '#64748b' }}>
            Required columns: <b>name</b>, <b>sku</b>. Optional: category, brand, model, unit, purchase_price, selling_price, mrp, barcode, description.
          </p>
        </Dragger>
      </Card>

      {/* Import Result Alert */}
      {importSummary && (
        <Alert
          type="success"
          message="Import Completed"
          description={`Successfully created ${importSummary.imported} products. Skipped ${importSummary.skipped} rows with errors.`}
          showIcon
          style={{ marginBottom: '24px', borderRadius: '8px' }}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/products')}>
              View Products
            </Button>
          }
        />
      )}

      {/* Preview Section */}
      {preview && (
        <Card
          title="Import Preview"
          extra={
            <Space>
              <Tag color="cyan">Total: {preview.total_rows}</Tag>
              <Tag color="green">Valid: {preview.valid_rows}</Tag>
              {preview.error_rows > 0 && <Tag color="red">Errors: {preview.error_rows}</Tag>}
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={importing}
                disabled={preview.valid_rows === 0}
                onClick={handleCommitImport}
              >
                Import {preview.valid_rows} Valid Rows
              </Button>
            </Space>
          }
          style={{ borderRadius: '12px' }}
        >
          <Table
            columns={previewColumns}
            dataSource={preview.preview}
            rowKey="row"
            loading={loadingPreview}
            pagination={{ pageSize: 15 }}
          />
        </Card>
      )}
    </div>
  )
}
