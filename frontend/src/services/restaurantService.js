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

// Owner — Hotel Rooms
export const getRooms          = ()         => api.get('/owner/hotel/rooms')
export const getRoomStatus     = ()         => api.get('/owner/hotel/rooms/status')
export const createRoom        = (data)     => api.post('/owner/hotel/rooms', data)
export const updateRoom        = (id, data) => api.put(`/owner/hotel/rooms/${id}`, data)
export const deleteRoom        = (id)       => api.delete(`/owner/hotel/rooms/${id}`)

// Owner — Hotel Guests
export const getGuests         = (params)   => api.get('/owner/hotel/guests', { params })
export const searchGuests      = (q)        => api.get('/owner/hotel/guests/search', { params: { q } })
export const createGuest       = (data)     => api.post('/owner/hotel/guests', data)
export const updateGuest       = (id, data) => api.put(`/owner/hotel/guests/${id}`, data)
export const getGuest          = (id)       => api.get(`/owner/hotel/guests/${id}`)

// Owner — Hotel Bookings
export const getBookings       = (params)   => api.get('/owner/hotel/bookings', { params })
export const getBookingCalendar= (params)   => api.get('/owner/hotel/bookings/calendar', { params })
export const getOccupancyReport= (params)   => api.get('/owner/hotel/bookings/occupancy', { params })
export const createBooking     = (data)     => api.post('/owner/hotel/bookings', data)
export const updateBooking     = (id, data) => api.put(`/owner/hotel/bookings/${id}`, data)
export const getBooking        = (id)       => api.get(`/owner/hotel/bookings/${id}`)
export const checkInBooking    = (id)       => api.post(`/owner/hotel/bookings/${id}/check-in`)
export const checkOutBooking   = (id, data) => api.post(`/owner/hotel/bookings/${id}/check-out`, data)
export const cancelBooking     = (id)       => api.post(`/owner/hotel/bookings/${id}/cancel`)

// Waiter — Room Service
export const getActiveRooms    = ()         => api.get('/waiter/room-service/active-rooms')
export const placeRoomService  = (data)     => api.post('/waiter/room-service/orders', data)

// Public (customer)
export const getPublicMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const placePublicOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const getCustomerMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const customerPlaceOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const getOrderStatus = (orderNumber) => api.get(`/public/orders/${orderNumber}/status`)
