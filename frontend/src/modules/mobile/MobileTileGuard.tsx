import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button } from 'antd'
import { useAuth } from '../../auth/AuthContext'

interface MobileTileGuardProps {
  tileId: string | string[]
  children: React.ReactNode
}

export const MobileTileGuard: React.FC<MobileTileGuardProps> = ({ tileId, children }) => {
  const { mobilePages } = useAuth()
  const navigate = useNavigate()

  const allowedIds = Array.isArray(tileId) ? tileId : [tileId]
  const isAllowed = allowedIds.some((id) => Boolean(mobilePages[id]))

  if (!isAllowed) {
    return (
      <div style={{ paddingTop: 12 }}>
        <Alert
          type="error"
          showIcon
          message="Access Restricted"
          description="This tile is not enabled for your account. Contact your administrator."
          style={{ borderRadius: 12, marginBottom: 14 }}
        />
        <Button type="primary" block size="large" onClick={() => navigate('/mobile')} style={{ borderRadius: 10 }}>
          Back to Home
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
