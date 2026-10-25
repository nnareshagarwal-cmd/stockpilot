import apiClient from './client'

export interface LovItem {
  id: string
  category: string
  label: string
  value: string
  sort_order: number
  is_active: boolean
  is_system: boolean
  description?: string
  option_id?: string
}

export interface LovSummaryItem {
  category: string
  total_count: number
  active_count: number
}

export interface LovCreatePayload {
  category: string
  label: string
  value?: string
  sort_order?: number
  description?: string
}

export interface LovUpdatePayload {
  label?: string
  value?: string
  sort_order?: number
  is_active?: boolean
  description?: string
}

export const lovApi = {
  getSummary: async (): Promise<LovSummaryItem[]> => {
    const res = await apiClient.get('/lov/summary')
    return res.data.data
  },

  getItems: async (category?: string, isActive?: boolean): Promise<LovItem[]> => {
    const params: any = {}
    if (category) params.category = category
    if (isActive !== undefined) params.is_active = isActive
    const res = await apiClient.get('/lov', { params })
    return res.data.data
  },

  createItem: async (data: LovCreatePayload): Promise<LovItem> => {
    const res = await apiClient.post('/lov', data)
    return res.data.data
  },

  updateItem: async (id: string, data: LovUpdatePayload): Promise<LovItem> => {
    const res = await apiClient.put(`/lov/${id}`, data)
    return res.data.data
  },

  archiveItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/lov/${id}`)
  },
}

export default lovApi
