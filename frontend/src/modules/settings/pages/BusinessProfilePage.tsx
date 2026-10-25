import React, { useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Row,
  Col,
  Typography,
  message,
  Divider,
} from 'antd'
import { SaveOutlined, ShopOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../../api/client'
import { ApiResponse, BusinessSummary } from '../../../api/types'

const { Title, Text } = Typography

export const BusinessProfilePage: React.FC = () => {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['business-profile'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>('/business/profile')
      return res.data.data
    },
  })

  useEffect(() => {
    if (profile) {
      form.setFieldsValue(profile)
    }
  }, [profile, form])

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      await apiClient.put('/business/profile', payload)
    },
    onSuccess: () => {
      message.success('Business profile updated successfully')
      queryClient.invalidateQueries({ queryKey: ['business-profile'] })
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error?.message || 'Failed to update profile')
    },
  })

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '48px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
          Business Profile
        </Title>
        <Text type="secondary">Manage your shop information, tax credentials, and contact details</Text>
      </div>

      <Card style={{ borderRadius: '12px' }} loading={isLoading}>
        <Form form={form} layout="vertical" onFinish={(val) => saveMutation.mutate(val)}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Shop / Display Name" name="name" rules={[{ required: true, message: 'Please enter shop name' }]}>
                <Input placeholder="e.g. Sharma Furniture" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Legal Entity Name" name="legal_name">
                <Input placeholder="e.g. Sharma Furniture Enterprises Pvt Ltd" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="GSTIN" name="gstin">
                <Input placeholder="e.g. 29ABCDE1234F1Z5" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="PAN Number" name="pan">
                <Input placeholder="e.g. ABCDE1234F" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Contact Email" name="email">
                <Input placeholder="contact@sharmafurniture.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Contact Phone" name="phone">
                <Input placeholder="9876543210" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Location & Address
          </Divider>

          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="Address Line 1" name="address_line1">
                <Input placeholder="Shop No. 12, Main Market" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Address Line 2" name="address_line2">
                <Input placeholder="Near Clock Tower" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="City" name="city">
                <Input placeholder="Bangalore" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="State" name="state">
                <Input placeholder="Karnataka" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Pincode" name="pincode">
                <Input placeholder="560001" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            System Preferences
          </Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Currency" name="currency" initialValue="INR">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Timezone" name="timezone" initialValue="Asia/Kolkata">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: 'right', marginTop: '16px' }}>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
            >
              Save Profile
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
