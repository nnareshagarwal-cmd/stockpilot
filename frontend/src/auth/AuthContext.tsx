import React, { createContext, useContext, useState, useEffect } from 'react'
import apiClient, { setAccessToken } from '../api/client'
import { CurrentUser, ApiResponse } from '../api/types'

interface AuthContextType {
  currentUser: CurrentUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (businessName: string, email: string, password: string, fullName: string, phone?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const res = await apiClient.get<ApiResponse<CurrentUser>>('/auth/me')
      setCurrentUser(res.data.data)
    } catch {
      setCurrentUser(null)
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
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
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
