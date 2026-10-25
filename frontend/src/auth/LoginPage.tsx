import React, { useState } from 'react'
import { Card, Form, Input, Button, Tabs, Typography, message, Space, Divider } from 'antd'
import { UserOutlined, LockOutlined, ShopOutlined, MailOutlined, PhoneOutlined, RocketOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

const { Title, Text, Paragraph } = Typography

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname || '/'

  const handleLogin = async (values: any) => {
    setLoading(true)
    try {
      await login(values.email, values.password)
      message.success('Welcome back to StockPilot!')
      navigate(from, { replace: true })
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Invalid email or password'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: any) => {
    setLoading(true)
    try {
      await register(values.business_name, values.email, values.password, values.full_name, values.phone)
      message.success('Business registered successfully! Welcome aboard.')
      navigate(from, { replace: true })
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Registration failed'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient decorative circles */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22, 119, 255, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          top: '-10%',
          left: '-10%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(0, 0, 0, 0) 70%)',
          bottom: '-15%',
          right: '-10%',
        }}
      />

      <Card
        style={{
          width: '100%',
          maxWidth: '460px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Space direction="vertical" size={4}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
                color: '#fff',
                fontSize: '26px',
                marginBottom: '8px',
                boxShadow: '0 8px 16px rgba(22, 119, 255, 0.3)',
              }}
            >
              <RocketOutlined />
            </div>
            <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
              StockPilot
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Multi-Tenant Inventory & Billing Management
            </Text>
          </Space>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'login' | 'register')}
          centered
          items={[
            {
              key: 'login',
              label: 'Sign In',
              children: (
                <Form layout="vertical" onFinish={handleLogin} style={{ marginTop: '16px' }}>
                  <Form.Item
                    label="Email Address"
                    name="email"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email' },
                    ]}
                  >
                    <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="admin@example.com" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="Password"
                    name="password"
                    rules={[{ required: true, message: 'Please enter your password' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                      placeholder="••••••••"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item style={{ marginTop: '24px' }}>
                    <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ height: '44px', fontWeight: 600 }}>
                      Sign In
                    </Button>
                  </Form.Item>

                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Default demo login: <b>demo@stockpilot.com</b> / <b>DemoPass123</b>
                    </Text>
                  </div>
                </Form>
              ),
            },
            {
              key: 'register',
              label: 'Register Business',
              children: (
                <Form layout="vertical" onFinish={handleRegister} style={{ marginTop: '16px' }}>
                  <Form.Item
                    label="Business / Shop Name"
                    name="business_name"
                    rules={[{ required: true, message: 'Please enter your business name' }]}
                  >
                    <Input prefix={<ShopOutlined style={{ color: '#94a3b8' }} />} placeholder="e.g. Sharma Furniture" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="Admin Full Name"
                    name="full_name"
                    rules={[{ required: true, message: 'Please enter your full name' }]}
                  >
                    <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="e.g. Rajesh Sharma" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="Admin Email"
                    name="email"
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email' },
                    ]}
                  >
                    <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="admin@sharmafurniture.com" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="Phone Number"
                    name="phone"
                  >
                    <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="9876543210" size="large" />
                  </Form.Item>

                  <Form.Item
                    label="Password"
                    name="password"
                    rules={[
                      { required: true, message: 'Please choose a password' },
                      { min: 6, message: 'Password must be at least 6 characters' },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="Minimum 6 characters" size="large" />
                  </Form.Item>

                  <Form.Item style={{ marginTop: '24px' }}>
                    <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ height: '44px', fontWeight: 600 }}>
                      Create Business Account
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
