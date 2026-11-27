import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Alert, Typography, Card, Space } from 'antd'
import {
  PhoneOutlined,
  DeleteOutlined,
  CheckOutlined,
  ShopOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { useAuth, MobileBusinessChoice } from '../../auth/AuthContext'

const { Title, Text } = Typography

export const MobileLoginPage: React.FC = () => {
  const { isAuthenticated, mobileLogin } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [businessChoices, setBusinessChoices] = useState<MobileBusinessChoice[] | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/mobile', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const submitLogin = async (selectedBusinessId?: string) => {
    if (!identifier.trim()) {
      setErrorMsg('Please enter your phone number or email')
      return
    }
    if (pin.length !== 4) {
      setErrorMsg('Please enter your 4-digit PIN')
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await mobileLogin(identifier.trim(), pin, selectedBusinessId)
      if (res.requiresBusinessSelection && res.businesses) {
        setBusinessChoices(res.businesses)
      } else {
        navigate('/mobile', { replace: true })
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Login failed. Please check your phone/email and PIN.'
      setErrorMsg(msg)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const handleDigit = (digit: string) => {
    if (loading || pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setErrorMsg(null)
  }

  const handleBackspace = () => {
    if (loading) return
    setPin((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    if (loading) return
    setPin('')
    setErrorMsg(null)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #1677ff 0%, #3b82f6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 22,
              color: '#fff',
              boxShadow: '0 8px 24px rgba(22, 119, 255, 0.35)',
              marginBottom: 10,
            }}
          >
            SP
          </div>
          <Title level={3} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
            StockPilot Mobile
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 13 }}>
            Sign in with your phone/email &amp; 4-digit PIN
          </Text>
        </div>

        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          bodyStyle={{ padding: 20 }}
        >
          {errorMsg && (
            <Alert
              type="error"
              showIcon
              icon={<LockOutlined />}
              message={errorMsg}
              style={{ marginBottom: 14, borderRadius: 10 }}
            />
          )}

          {businessChoices ? (
            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                Select Business
              </Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                Your account belongs to multiple businesses. Choose one to continue:
              </Text>
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {businessChoices.map((biz) => (
                  <Button
                    key={biz.id}
                    size="large"
                    block
                    icon={<ShopOutlined />}
                    loading={loading}
                    onClick={() => submitLogin(biz.id)}
                    style={{ height: 48, textAlign: 'left', fontWeight: 600, borderRadius: 10 }}
                  >
                    {biz.name}
                  </Button>
                ))}
                <Button
                  type="link"
                  block
                  onClick={() => {
                    setBusinessChoices(null)
                    setPin('')
                  }}
                >
                  Back
                </Button>
              </Space>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 14 }}>
                <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                  Phone Number or Email
                </Text>
                <Input
                  size="large"
                  prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="e.g. 9876543210 or name@shop.com"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    setErrorMsg(null)
                  }}
                  autoComplete="username"
                  style={{ borderRadius: 10, height: 44 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                  4-Digit PIN
                </Text>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
                  {[0, 1, 2, 3].map((idx) => {
                    const filled = idx < pin.length
                    return (
                      <div
                        key={idx}
                        style={{
                          width: 48,
                          height: 52,
                          borderRadius: 12,
                          border: `2px solid ${filled ? '#1677ff' : '#cbd5e1'}`,
                          background: filled ? '#eff6ff' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        {filled ? '●' : ''}
                      </div>
                    )
                  })}
                </div>

                {/* Hidden/accessible input for keyboard entry on desktop/autofill */}
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setPin(digits)
                    setErrorMsg(null)
                  }}
                  onPressEnter={() => submitLogin()}
                  placeholder="Or type 4-digit PIN here"
                  style={{ marginBottom: 12, borderRadius: 8, textAlign: 'center' }}
                />

                {/* Touch Keypad */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                  }}
                >
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <Button
                      key={d}
                      onClick={() => handleDigit(d)}
                      style={{
                        height: 48,
                        fontSize: 18,
                        fontWeight: 700,
                        borderRadius: 10,
                      }}
                    >
                      {d}
                    </Button>
                  ))}
                  <Button
                    onClick={handleClear}
                    style={{ height: 48, fontSize: 13, fontWeight: 600, borderRadius: 10, color: '#64748b' }}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={() => handleDigit('0')}
                    style={{ height: 48, fontSize: 18, fontWeight: 700, borderRadius: 10 }}
                  >
                    0
                  </Button>
                  <Button
                    icon={<DeleteOutlined />}
                    onClick={handleBackspace}
                    style={{ height: 48, borderRadius: 10 }}
                    aria-label="Backspace"
                  />
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<CheckOutlined />}
                loading={loading}
                disabled={pin.length !== 4 || !identifier.trim()}
                onClick={() => submitLogin()}
                style={{ height: 46, borderRadius: 10, fontWeight: 700, fontSize: 15 }}
              >
                Sign In
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
