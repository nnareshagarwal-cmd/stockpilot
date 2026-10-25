import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { MainLayout } from './layouts/MainLayout'
import { LandingPage } from './modules/home/LandingPage'
import { ProductListPage } from './modules/catalogue/pages/ProductListPage'
import { ProductFormPage } from './modules/catalogue/pages/ProductFormPage'
import { ProductDetailPage } from './modules/catalogue/pages/ProductDetailPage'
import { CsvImportPage } from './modules/catalogue/pages/CsvImportPage'
import { CategoriesPage } from './modules/settings/pages/CategoriesPage'
import { BrandsPage } from './modules/settings/pages/BrandsPage'
import { UnitsPage } from './modules/settings/pages/UnitsPage'
import { LocationsPage } from './modules/settings/pages/LocationsPage'
import { StockConditionsPage } from './modules/settings/pages/StockConditionsPage'
import { TaxRatesPage } from './modules/settings/pages/TaxRatesPage'
import { AttributesPage } from './modules/settings/pages/AttributesPage'
import { LookupMasterPage } from './modules/settings/pages/LookupMasterPage'
import { BusinessProfilePage } from './modules/settings/pages/BusinessProfilePage'
import { UsersPage } from './modules/settings/pages/UsersPage'
import { StockBalancesPage } from './modules/stock/StockBalancesPage'
import { StockMappingPage } from './modules/stock/StockMappingPage'
import { StockTransfersPage } from './modules/stock/StockTransfersPage'
import { StockMovementsPage } from './modules/stock/StockMovementsPage'
import { StockAgeingPage } from './modules/stock/StockAgeingPage'

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LandingPage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="products/:id/edit" element={<ProductFormPage />} />
        <Route path="products/import" element={<CsvImportPage />} />

        {/* Inventory & Stock (Phase 2) */}
        <Route path="stock/mapping" element={<StockMappingPage />} />
        <Route path="stock/balances" element={<StockBalancesPage />} />
        <Route path="stock/transfers" element={<StockTransfersPage />} />
        <Route path="stock/movements" element={<StockMovementsPage />} />
        <Route path="stock/ageing" element={<StockAgeingPage />} />

        {/* Master Data & Settings */}
        <Route path="settings/categories" element={<CategoriesPage />} />
        <Route path="settings/brands" element={<BrandsPage />} />
        <Route path="settings/units" element={<UnitsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="settings/stock-conditions" element={<StockConditionsPage />} />
        <Route path="settings/tax-rates" element={<TaxRatesPage />} />
        <Route path="settings/attributes" element={<AttributesPage />} />
        <Route path="settings/lookups" element={<LookupMasterPage />} />
        <Route path="settings/business" element={<BusinessProfilePage />} />
        <Route
          path="settings/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
