export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginationMeta {
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: string[]
  }
}

export interface UserSummary {
  id: string
  email: string
  full_name: string
  phone?: string
  role?: string
  is_active: boolean
}

export interface BusinessSummary {
  id: string
  name: string
  legal_name?: string
  currency: string
  timezone: string
  city?: string
  state?: string
  gstin?: string
}

export interface CurrentUser {
  user: UserSummary
  business: BusinessSummary
  role: {
    name: string
    display_name: string
  }
  permissions: string[]
}

export interface CategoryTreeItem {
  id: string
  name: string
  code?: string
  parent_id?: string
  description?: string
  sort_order: number
  is_active: boolean
  children?: CategoryTreeItem[]
}

export interface Brand {
  id: string
  name: string
  description?: string
  logo_url?: string
  website?: string
  is_active: boolean
}

export interface UnitOfMeasure {
  id: string
  code: string
  name: string
  decimal_places: number
  is_active: boolean
}

export interface LocationTreeItem {
  id: string
  name: string
  code?: string
  location_type: string
  parent_id?: string
  description?: string
  sort_order: number
  is_active: boolean
  children?: LocationTreeItem[]
}

export interface StockCondition {
  id: string
  name: string
  code: string
  is_sellable: boolean
  description?: string
  sort_order: number
  is_active: boolean
}

export interface TaxRate {
  id: string
  name: string
  rate: number
  hsn_code?: string
  sac_code?: string
  description?: string
  is_active: boolean
}

export interface AttributeOption {
  id: string
  value: string
  sort_order: number
  is_active: boolean
}

export interface AttributeDefinition {
  id: string
  name: string
  code: string
  data_type: 'text' | 'number' | 'decimal' | 'boolean' | 'date' | 'single_choice' | 'multiple_choice'
  category_id?: string
  is_required: boolean
  is_searchable: boolean
  is_filterable: boolean
  unit_label?: string
  description?: string
  sort_order: number
  is_active: boolean
  options?: AttributeOption[]
}

export interface VariantDetail {
  id: string
  sku: string
  variant_name?: string
  barcode?: string
  barcode_type?: string
  unit_id?: string
  unit_name?: string
  unit_code?: string
  purchase_price: number
  selling_price: number
  mrp?: number
  reorder_point?: number
  reorder_quantity?: number
  weight_kg?: number
  is_active: boolean
}

export interface AttributeValueDetail {
  id: string
  attribute_id: string
  attribute_name: string
  attribute_code: string
  data_type: string
  unit_label?: string
  variant_id?: string
  text_value?: string
  numeric_value?: number
  decimal_value?: number
  boolean_value?: boolean
  date_value?: string
  option_id?: string
  option_label?: string
  option_ids?: string[]
  formatted_value: string
}

export interface ProductImage {
  id: string
  file_url: string
  file_name: string
  file_size?: number
  caption?: string
  is_primary: boolean
  sort_order: number
}

export interface ProductDetail {
  id: string
  name: string
  description?: string
  category_id?: string
  category_name?: string
  subcategory_id?: string
  subcategory_name?: string
  brand_id?: string
  brand_name?: string
  model?: string
  tax_rate_id?: string
  tax_rate_name?: string
  tax_rate_percent?: number
  is_active: boolean
  created_at: string
  variants: VariantDetail[]
  attributes: AttributeValueDetail[]
  images: ProductImage[]
}

export interface ProductSearchItem {
  id: string
  name: string
  category?: string
  category_id?: string
  subcategory?: string
  subcategory_id?: string
  brand?: string
  brand_id?: string
  model?: string
  primary_image_url?: string
  default_sku?: string
  selling_price?: number
  mrp?: number
  variant_count: number
  is_active: boolean
  locations?: string[]
}

export interface CsvRowPreview {
  row: number
  status: 'valid' | 'error'
  data: Record<string, any>
  errors: string[]
}

export interface CsvPreviewResponse {
  total_rows: number
  valid_rows: number
  error_rows: number
  preview: CsvRowPreview[]
}

export interface CsvImportResult {
  imported: number
  skipped: number
  errors: any[]
}

export interface ListOfValuesItem {
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

