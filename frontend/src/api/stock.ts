import apiClient from './client'

export interface StockBalanceItem {
  id: string
  variant_id: string
  product_id?: string
  product_name?: string
  variant_name?: string
  sku?: string
  location_id: string
  location_name?: string
  condition_id: string
  condition_name?: string
  is_sellable?: boolean
  quantity: number
  reserved_quantity: number
  available_quantity: number
  updated_at: string
}

export interface StockMovementItem {
  id: string
  movement_type: string
  variant_id: string
  product_name?: string
  variant_name?: string
  sku?: string
  location_id: string
  location_name?: string
  condition_id: string
  condition_name?: string
  quantity: number
  balance_after: number
  unit_cost?: number
  reference_type?: string
  reference_id?: string
  reference_number?: string
  notes?: string
  created_by_name?: string
  created_at: string
}

export interface StockTransferItem {
  id: string
  variant_id: string
  sku?: string
  product_name?: string
  condition_id: string
  condition_name?: string
  quantity: number
  received_quantity: number
}

export interface StockTransfer {
  id: string
  transfer_number: string
  source_location_id: string
  source_location_name?: string
  destination_location_id: string
  destination_location_name?: string
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED'
  dispatched_at?: string
  received_at?: string
  notes?: string
  created_at: string
  items: StockTransferItem[]
}

export interface AgeingItem {
  variant_id: string
  sku: string
  product_name: string
  category_name?: string
  total_quantity: number
  total_valuation: number
  bands: Record<string, number>
}

export interface AgeingSummary {
  total_valuation: number
  total_quantity: number
  bands: Record<string, number>
  items: AgeingItem[]
}

export interface ReconciliationMismatch {
  variant_id: string
  sku?: string
  product_name?: string
  location_id: string
  location_name?: string
  condition_id: string
  condition_name?: string
  movement_sum: number
  balance_recorded: number
  difference: number
}

export interface ReconciliationResponse {
  is_balanced: boolean
  total_checked: number
  mismatches: ReconciliationMismatch[]
}

export interface LowStockItem {
  variant_id: string
  product_id: string
  sku: string
  product_name: string
  category_name?: string
  reorder_point: number
  available_quantity: number
  shortfall: number
}

export const stockApi = {
  getBalances: async (params?: {
    variant_id?: string
    location_id?: string
    condition_id?: string
    is_sellable?: boolean
    search?: string
    page?: number
    page_size?: number
  }) => {
    const res = await apiClient.get('/stock/balances', { params })
    return res.data
  },

  getMovements: async (params?: {
    variant_id?: string
    location_id?: string
    movement_type?: string
    page?: number
    page_size?: number
  }) => {
    const res = await apiClient.get('/stock/movements', { params })
    return res.data
  },

  getTransfers: async (params?: { status?: string; page?: number; page_size?: number }) => {
    const res = await apiClient.get('/stock/transfers', { params })
    return res.data
  },

  getTransfer: async (id: string) => {
    const res = await apiClient.get(`/stock/transfers/${id}`)
    return res.data.data
  },

  createTransfer: async (data: {
    source_location_id: string
    destination_location_id: string
    notes?: string
    items: Array<{ variant_id: string; condition_id: string; quantity: number }>
  }) => {
    const res = await apiClient.post('/stock/transfers', data)
    return res.data.data
  },

  receiveTransfer: async (id: string, data?: { items?: Array<{ item_id: string; received_quantity: number }>; notes?: string }) => {
    const res = await apiClient.put(`/stock/transfers/${id}/receive`, data)
    return res.data.data
  },

  changeCondition: async (data: {
    variant_id: string
    location_id: string
    from_condition_id: string
    to_condition_id: string
    quantity: number
    notes?: string
  }) => {
    const res = await apiClient.post('/stock/condition-change', data)
    return res.data
  },

  createAdjustment: async (data: {
    variant_id: string
    location_id: string
    condition_id: string
    quantity_delta: number
    reason_code: string
    notes?: string
  }) => {
    const res = await apiClient.post('/stock/adjustments', data)
    return res.data.data
  },

  getAgeing: async (): Promise<AgeingSummary> => {
    const res = await apiClient.get('/stock/ageing')
    return res.data
  },

  getReconciliation: async (): Promise<ReconciliationResponse> => {
    const res = await apiClient.get('/stock/reconciliation')
    return res.data
  },

  getLowStock: async (): Promise<{ data: LowStockItem[] }> => {
    const res = await apiClient.get('/stock/low-stock')
    return res.data
  },

  getProductStockMapping: async (productId: string): Promise<StockMappingResponse> => {
    const res = await apiClient.get(`/stock/mapping/${productId}`)
    return res.data.data
  },

  allocateStock: async (
    productId: string,
    data: {
      variant_id: string
      location_id: string
      quantity: number
      condition_id?: string
      mode?: 'set_total' | 'add'
      notes?: string
    }
  ): Promise<StockMappingResponse> => {
    const res = await apiClient.post(`/stock/mapping/${productId}/allocate`, data)
    return res.data.data
  },
}

export interface StockMappingLocation {
  id: string
  variant_id: string
  sku: string
  variant_name: string
  location_id: string
  location_name: string
  location_code?: string
  condition_id: string
  condition_name: string
  is_sellable: boolean
  quantity: number
}

export interface StockMappingProduct {
  id: string
  name: string
  model?: string
  category_name?: string
  brand_name?: string
  variants: Array<{
    id: string
    sku: string
    variant_name: string
    purchase_price: number
    selling_price: number
    mrp?: number
  }>
}

export interface StockMappingSummary {
  total_stock: number
  available_to_sell: number
  total_sold: number
}

export interface StockMappingResponse {
  product: StockMappingProduct
  summary: StockMappingSummary
  locations: StockMappingLocation[]
}
