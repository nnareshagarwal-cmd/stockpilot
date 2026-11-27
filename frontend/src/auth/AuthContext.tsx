import React, { createContext, useContext, useState, useEffect } from 'react'
import apiClient, { setAccessToken } from '../api/client'
import { CurrentUser, ApiResponse } from '../api/types'

export interface MobileBusinessChoice {
  id: string
  name: string
}

export interface MobileLoginResult {
  requiresBusinessSelection: boolean
  businesses?: MobileBusinessChoice[]
}

interface AuthContextType {
  currentUser: CurrentUser | null
  mobilePages: Record<string, boolean>
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  mobileLogin: (identifier: string, pin: string, businessId?: string) => Promise<MobileLoginResult>
  register: (businessName: string, email: string, password: string, fullName: string, phone?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  refreshMobilePages: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [mobilePages, setMobilePages] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)

  const refreshMobilePages = async () => {
    try {
      const res = await apiClient.get<ApiResponse<{ mobile_pages: Record<string, boolean> }>>('/mobile/me')
      setMobilePages(res.data.data.mobile_pages || {})
    } catch {
      setMobilePages({})
    }
  }

  const refreshUser = async () => {
    try {
      const res = await apiClient.get<ApiResponse<CurrentUser>>('/auth/me')
      setCurrentUser(res.data.data)
      if (window.location.pathname.startsWith('/mobile')) {
        await refreshMobilePages()
      }
    } catch {
      setCurrentUser(null)
      setMobilePages({})
      setAccessToken(null)
    }
  }

  useEffect(() => {
    // Attempt initial session restore via refresh cookie
    const initAuth = async () => {
      try {
        const refreshRes = await apiClient.post('/auth/refresh')
        const token = refreshRes.data.data.access_token
        setAccessToken(token)
        await refreshUser()
      } catch {
        // No valid session, stay logged out
      } finally {
        setIsLoading(false)
      }
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password })
    const token = res.data.data.access_token
    setAccessToken(token)
    await refreshUser()
  }

  const mobileLogin = async (
    identifier: string,
    pin: string,
    businessId?: string
  ): Promise<MobileLoginResult> => {
    const payload: Record<string, string> = { identifier, pin }
    if (businessId) payload.business_id = businessId
    const res = await apiClient.post('/mobile/login', payload)
    const data = res.data.data
    if (data.requires_business_selection) {
      return {
        requiresBusinessSelection: true,
        businesses: data.businesses || [],
      }
    }
    setAccessToken(data.access_token)
    setMobilePages(data.mobile_pages || {})
    await refreshUser()
    return { requiresBusinessSelection: false }
  }

  const register = async (
    businessName: string,
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ) => {
    const res = await apiClient.post('/auth/register', {
      business_name: businessName,
      email,
      password,
      full_name: fullName,
      phone,
    })
    const token = res.data.data.access_token
    setAccessToken(token)
    await refreshUser()
  }

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      setAccessToken(null)
      setCurrentUser(null)
      setMobilePages({})
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        mobilePages,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        mobileLogin,
        register,
        logout,
        refreshUser,
        refreshMobilePages,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
