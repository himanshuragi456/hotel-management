import api from './api'

// Owner — Menu
export const getCategories = () => api.get('/owner/menu/categories')
export const createCategory = (data) => api.post('/owner/menu/categories', data)
export const updateCategory = (id, data) => api.put(`/owner/menu/categories/${id}`, data)
export const deleteCategory = (id) => api.delete(`/owner/menu/categories/${id}`)

export const getMenuItems = (params) => api.get('/owner/menu/items', { params })
export const createMenuItem = (data) => api.post('/owner/menu/items', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const updateMenuItem = (id, data) => api.post(`/owner/menu/items/${id}?_method=PUT`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteMenuItem = (id) => api.delete(`/owner/menu/items/${id}`)
export const bulkToggleItems = (ids, is_available) => api.post('/owner/menu/items/bulk-toggle', { ids, is_available })

// Owner — Tables
export const getTables = () => api.get('/owner/tables')
export const createTable = (data) => api.post('/owner/tables', data)
export const updateTable = (id, data) => api.put(`/owner/tables/${id}`, data)
export const deleteTable = (id) => api.delete(`/owner/tables/${id}`)
export const getTableQr = (id) => api.get(`/owner/tables/${id}/qr`, { responseType: 'blob' })

// Owner — Revenue
export const getLiveOrders = () => api.get('/owner/orders/live')
export const getTodayRevenue = () => api.get('/owner/revenue/today')
export const getOrdersReport = (params) => api.get('/owner/orders/report', { params })
export const exportOrdersPdf = (params) => api.get('/owner/orders/export/pdf', { params, responseType: 'blob' })

// Owner — Expenses
export const getExpenses = (params) => api.get('/owner/expenses', { params })
export const createExpense = (data) => api.post('/owner/expenses', data)
export const deleteExpense = (id) => api.delete(`/owner/expenses/${id}`)

// Waiter
export const getWaiterTables = () => api.get('/waiter/tables')
export const getWaiterMenu = () => api.get('/waiter/menu')
export const placeOrder = (data) => api.post('/waiter/orders', data)
export const addOrderItems = (orderId, data) => api.post(`/waiter/orders/${orderId}/items`, data)
export const getMyOrders = () => api.get('/waiter/orders/my')

// Chef
export const getKitchenOrders = () => api.get('/chef/orders')
export const updateOrderStatus = (id, status) => api.put(`/chef/orders/${id}/status`, { status })

// Billing
export const getReadyOrders = () => api.get('/billing/orders/ready')
export const getAllBillingOrders = (params) => api.get('/billing/orders', { params })
export const createInvoice = (data) => api.post('/billing/invoices', data)
export const getInvoice = (id) => api.get(`/billing/invoices/${id}`)
export const downloadInvoicePdf = (id, upiId) => api.get(`/billing/invoices/${id}/pdf`, { params: { upi_id: upiId }, responseType: 'blob' })

// Waiter aliases
export const getWaiterOrders = () => api.get('/waiter/orders/my')

// Public (customer)
export const getPublicMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const placePublicOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const getCustomerMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const customerPlaceOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const getOrderStatus = (orderNumber) => api.get(`/public/orders/${orderNumber}/status`)
