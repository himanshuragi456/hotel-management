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

// Waiter — tables & menu (separate from owner routes)
export const getWaiterTables      = ()         => api.get('/waiter/tables')
export const getWaiterMenu        = ()         => api.get('/waiter/menu')
export const getWaiterTableOrders = (tableId)  => api.get(`/waiter/tables/${tableId}/orders`)

// Owner — Tables
export const getTables = () => api.get('/owner/tables')
export const createTable = (data) => api.post('/owner/tables', data)
export const updateTable = (id, data) => api.put(`/owner/tables/${id}`, data)
export const deleteTable = (id) => api.delete(`/owner/tables/${id}`)
export const getTableQr = (id) => api.get(`/owner/tables/${id}/qr`, { responseType: 'text' })

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
export const placeOrder      = (data)            => api.post('/waiter/orders', data)
export const getWaiterOrder  = (id)              => api.get(`/waiter/orders/${id}`)
export const addOrderItems   = (orderId, data)   => api.post(`/waiter/orders/${orderId}/items`, data)
export const requestBill     = (orderId)         => api.post(`/waiter/orders/${orderId}/request-bill`)
export const markServed      = (orderId)         => api.post(`/waiter/orders/${orderId}/mark-served`)
export const getMyOrders     = ()                => api.get('/waiter/orders/my')

// Chef
export const getKitchenOrders = () => api.get('/chef/orders')
export const updateOrderStatus = (id, status) => api.put(`/chef/orders/${id}/status`, { status })

// Billing — Hotel (billing role has access to these)
export const getBillingRoomStatus   = ()         => api.get('/billing/hotel/rooms/status')
export const getBillingRooms        = ()         => api.get('/billing/hotel/rooms')
export const getBillingActiveRooms  = ()         => api.get('/billing/hotel/active-rooms')
export const getBillingBookings     = (params)   => api.get('/billing/hotel/bookings', { params })
export const createBillingBooking   = (data)     => api.post('/billing/hotel/bookings', data)
export const getBillingBooking      = (id)       => api.get(`/billing/hotel/bookings/${id}`)
export const checkInBillingBooking  = (id)       => api.post(`/billing/hotel/bookings/${id}/check-in`)
export const checkOutBillingBooking              = (id, data) => api.post(`/billing/hotel/bookings/${id}/check-out`, data)
export const cancelBillingBooking                = (id)       => api.post(`/billing/hotel/bookings/${id}/cancel`)
export const getBillingBookingCheckoutSummary    = (id)       => api.get(`/billing/hotel/bookings/${id}/checkout-summary`)
export const extendBillingBookingStay            = (id, data) => api.patch(`/billing/hotel/bookings/${id}/extend`, data)
export const searchBillingGuests    = (q)        => api.get('/billing/hotel/guests/search', { params: { q } })
export const createBillingGuest     = (data)     => api.post('/billing/hotel/guests', data)

// Billing
export const getReadyOrders      = ()              => api.get('/billing/orders/ready')
export const getActiveOrders     = ()              => api.get('/billing/orders/active')
export const getAllBillingOrders  = (params)        => api.get('/billing/orders', { params })
export const getBillingTables    = ()              => api.get('/billing/tables')
export const getBillingTableOrders   = (tableId) => api.get(`/billing/tables/${tableId}/orders`)
export const getBillingTableHistory  = (tableId) => api.get(`/billing/tables/${tableId}/history`)
export const closeBillingTable   = (tableId)       => api.post(`/billing/tables/${tableId}/close`)
export const billAllOrders       = (tableId, data) => api.post(`/billing/tables/${tableId}/bill-all`, data)
export const billingNewOrder      = (data)          => api.post('/billing/orders', data)
export const billingAddItems      = (orderId, data) => api.post(`/billing/orders/${orderId}/items`, data)
export const billingPlaceTakeaway = (data)          => api.post('/billing/takeaway/orders', data)
export const billingMarkServed      = (orderId)         => api.post(`/billing/orders/${orderId}/mark-served`)
export const billingUpdateStatus    = (orderId, status) => api.put(`/billing/orders/${orderId}/status`, { status })
export const getBillingMenu      = ()              => api.get('/billing/menu')
export const createInvoice       = (data)          => api.post('/billing/invoices', data)
export const getInvoice          = (id)            => api.get(`/billing/invoices/${id}`)
export const getRecentInvoices   = ()              => api.get('/billing/invoices/recent')
export const downloadInvoicePdf  = (id, upiId)     => api.get(`/billing/invoices/${id}/pdf`, { params: { upi_id: upiId }, responseType: 'blob' })
export const downloadCombinedPdf = (ids)           => api.get(`/billing/invoices/combined-pdf`, { params: { ids: ids.join(',') }, responseType: 'blob' })

// Waiter aliases
export const getWaiterOrders = () => api.get('/waiter/orders/my')

// Owner — Analytics
export const getAnalyticsOverview = (params) => api.get('/owner/analytics/overview', { params })
export const getOwnerAuditLog     = (params) => api.get('/owner/analytics/audit-log', { params })

// Notifications (all roles)
export const getNotifications  = ()    => api.get('/notifications')
export const markNotifRead     = (id)  => id ? api.post(`/notifications/${id}/mark-read`) : api.post('/notifications/mark-read')
export const clearNotifications= ()    => api.delete('/notifications')

// Owner — Feedback
export const getFeedbackQrCodes      = ()         => api.get('/owner/feedback/qr-codes')
export const createFeedbackQrCode    = (data)     => api.post('/owner/feedback/qr-codes', data)
export const updateFeedbackQrCode    = (id, data) => api.put(`/owner/feedback/qr-codes/${id}`, data)
export const deleteFeedbackQrCode    = (id)       => api.delete(`/owner/feedback/qr-codes/${id}`)
export const downloadFeedbackQr      = (id)       => api.get(`/owner/feedback/qr-codes/${id}/download`, { responseType: 'text' })
export const getReviewConfig         = ()         => api.get('/owner/feedback/review-config')
export const updateReviewConfig      = (data)     => api.put('/owner/feedback/review-config', data)
export const findGooglePlace         = (data)     => api.post('/owner/feedback/find-place', data)
export const getFeedbackDashboard    = (params)   => api.get('/owner/feedback/dashboard', { params })

// Public — Feedback submission
export const getFeedbackPage         = (token)    => api.get(`/public/feedback/${token}`)
export const submitFeedback          = (token, data) => api.post(`/public/feedback/${token}/submit`, data)
export const getAiSuggestions        = (token, data) => api.post(`/public/feedback/${token}/ai-suggestions`, data)

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
export const getBooking              = (id)       => api.get(`/owner/hotel/bookings/${id}`)
export const checkInBooking          = (id)       => api.post(`/owner/hotel/bookings/${id}/check-in`)
export const checkOutBooking         = (id, data) => api.post(`/owner/hotel/bookings/${id}/check-out`, data)
export const cancelBooking           = (id)       => api.post(`/owner/hotel/bookings/${id}/cancel`)
export const getBookingCheckoutSummary = (id)     => api.get(`/owner/hotel/bookings/${id}/checkout-summary`)
export const extendBookingStay         = (id, data) => api.patch(`/owner/hotel/bookings/${id}/extend`, data)

// Waiter — Room Service
export const getActiveRooms    = ()         => api.get('/waiter/room-service/active-rooms')
export const placeRoomService  = (data)     => api.post('/waiter/room-service/orders', data)

// Public (customer)
export const getPublicMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const placePublicOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const getCustomerMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const customerPlaceOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const customerRequestBill = (slug, token) => api.post(`/public/menu/${slug}/${token}/request-bill`)
export const customerCallWaiter  = (slug, token) => api.post(`/public/menu/${slug}/${token}/call-waiter`)
export const getOrderStatus = (orderNumber) => api.get(`/public/orders/${orderNumber}/status`)

// Owner — Staff
export const getBillingWaiters        = ()         => api.get('/billing/staff/waiters')
export const billingPlaceRoomService  = (data)     => api.post('/billing/hotel/room-service/orders', data)
export const getBillingBookingOrders  = (bookingId) => api.get(`/billing/hotel/bookings/${bookingId}/orders`)
export const billingMarkServedRoom    = (orderId)   => api.post(`/billing/orders/${orderId}/mark-served-room`)
export const getStaff          = ()         => api.get('/owner/staff')
export const createStaff       = (data)     => api.post('/owner/staff', data)
export const updateStaff       = (id, data) => api.put(`/owner/staff/${id}`, data)
export const deleteStaff       = (id)       => api.delete(`/owner/staff/${id}`)
export const toggleStaffActive = (id)       => api.post(`/owner/staff/${id}/toggle-active`)


// Owner — Settings
export const getOwnerSettings    = ()     => api.get('/owner/settings')
export const updateOwnerSettings = (data) => api.put('/owner/settings', data)
export const getTenantSettings   = ()     => api.get('/tenant-settings')
export const changeOwnPassword   = (data) => api.post('/owner/change-password', data)
