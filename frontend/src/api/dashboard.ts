import apiClient from './client'

export interface InventorySummary {
  total_products: number
  total_stock: number | string
  available_stock: number | string
  reserved_stock: number | string
  inventory_valuation?: number | string | null
  valuation_basis: string
  can_view_valuation: boolean
}

export interface StockHealth {
  low_stock_products: number
  out_of_stock_products: number
  damaged_stock: number | string
  products_with_stock: number
}

export interface AgeingBand {
  category: string
  period: string
  quantity: number | string
  valuation: number | string
  percentage: number
}

export interface DashboardAgeing {
  total_valuation: number | string
  total_quantity: number | string
  bands: AgeingBand[]
}

export interface ActionRequired {
  replenishment_products: number
  out_of_stock_products: number
  pending_transfers: number
  reconciliation_balanced: boolean
  reconciliation_discrepancies: number
}

export interface RecentStockActivity {
  id: string
  created_at: string
  product_name: string
  variant_name?: string | null
  sku: string
  movement_type: string
  activity: string
  quantity: number | string
  location_name: string
  reference_number?: string | null
}

export interface DashboardSummary {
  inventory: InventorySummary
  stock_health: StockHealth
  ageing?: DashboardAgeing | null
  action_required: ActionRequired
  recent_activity: RecentStockActivity[]
  business_id: string
  business_name?: string
  user_role: string
}

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const res = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return res.data
  },
}

export default dashboardApi
