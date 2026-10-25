import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spin, Result, Button } from 'antd'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, currentUser } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="Loading StockPilot..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role.name)) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
        <Result
          status="403"
          title="403"
          subTitle="Sorry, you are not authorized to access this page."
          extra={
            <Button type="primary" onClick={() => (window.location.href = '/')}>
              Back Home
            </Button>
          }
        />
      </div>
    )
  }

  return <>{children}</>
}
