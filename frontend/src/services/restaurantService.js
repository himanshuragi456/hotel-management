import api from './api'

// Owner — Menu
export const getCategories = () => api.get('/owner/menu/categories')
export const createCategory = (data) => api.post('/owner/menu/categories', data)
export const updateCategory = (id, data) => api.put(`/owner/menu/categories/${id}`, data)
export const deleteCategory = (id) => api.delete(`/owner/menu/categories/${id}`)
export const reorderCategories = (ids) => api.post('/owner/menu/categories/reorder', { ids })

export const getMenuItems = (params) => api.get('/owner/menu/items', { params })
export const createMenuItem = (data) => api.post('/owner/menu/items', data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const updateMenuItem = (id, data) => api.post(`/owner/menu/items/${id}?_method=PUT`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteMenuItem = (id) => api.delete(`/owner/menu/items/${id}`)
export const bulkToggleItems = (ids, is_available) => api.post('/owner/menu/items/bulk-toggle', { ids, is_available })

// Owner — Menu: category day/time schedule
export const setCategorySchedules = (categoryId, schedules) => api.put(`/owner/menu/categories/${categoryId}/schedules`, { schedules })

// Owner — Menu: variants
export const createVariant = (itemId, data) => api.post(`/owner/menu/items/${itemId}/variants`, data)
export const updateVariant = (variantId, data) => api.put(`/owner/menu/variants/${variantId}`, data)
export const deleteVariant = (variantId) => api.delete(`/owner/menu/variants/${variantId}`)

// Owner — Menu: add-on groups & add-ons
export const createAddonGroup = (itemId, data) => api.post(`/owner/menu/items/${itemId}/addon-groups`, data)
export const updateAddonGroup = (groupId, data) => api.put(`/owner/menu/addon-groups/${groupId}`, data)
export const deleteAddonGroup = (groupId) => api.delete(`/owner/menu/addon-groups/${groupId}`)
export const createAddon = (groupId, data) => api.post(`/owner/menu/addon-groups/${groupId}/addons`, data)
export const updateAddon = (addonId, data) => api.put(`/owner/menu/addons/${addonId}`, data)
export const deleteAddon = (addonId) => api.delete(`/owner/menu/addons/${addonId}`)

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

// Order actions — reject (with reason), cancel, mark OOS (chef/billing/owner)
export const getRejectionReasons = () => api.get('/order-actions/rejection-reasons')
export const rejectOrder = (id, data) => api.post(`/order-actions/${id}/reject`, data)
export const cancelOrder  = (id, data) => api.post(`/order-actions/${id}/cancel`, data)
export const dismissOrder = (id)       => api.delete(`/order-actions/${id}/dismiss`)
export const markOos = (data) => api.post('/order-actions/mark-oos', data)

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
export const downloadBillingBookingBill          = (id, paymentMethod) => api.get(`/billing/hotel/bookings/${id}/bill`, { params: { payment_method: paymentMethod }, responseType: 'blob' })
export const getBillingRecentCheckouts           = ()                  => api.get('/billing/hotel/bookings/recent-checkouts')
export const searchBillingGuests    = (q)        => api.get('/billing/hotel/guests/search', { params: { q } })
export const createBillingGuest     = (data)     => api.post('/billing/hotel/guests', data)

// Billing
export const getPendingMtOrders     = ()                        => api.get('/billing/magic-tables/pending')
export const confirmMtPayment       = (slug, orderId, data)     => api.post(`/billing/magic-tables/${slug}/orders/${orderId}/confirm-payment`, data)
export const discardMtOrder         = (slug, orderId)           => api.post(`/billing/magic-tables/${slug}/orders/${orderId}/discard`)
export const getBillPaidTables      = ()                        => api.get('/billing/magic-tables/bill-paid')
export const confirmBillPaid        = (tableId)                 => api.post(`/billing/magic-tables/tables/${tableId}/confirm-bill-paid`)
export const rejectBillPaid         = (tableId)                 => api.post(`/billing/magic-tables/tables/${tableId}/reject-bill-paid`)
export const getReadyOrders      = ()              => api.get('/billing/orders/ready')
export const getActiveOrders     = ()              => api.get('/billing/orders/active')
export const getUnbilledTakeaway = ()              => api.get('/billing/orders/unbilled-takeaway')
export const getAllBillingOrders  = (params)        => api.get('/billing/orders', { params })
export const getBillingTables    = ()              => api.get('/billing/tables')
export const getBillingTableOrders   = (tableId) => api.get(`/billing/tables/${tableId}/orders`)
export const getBillingTableHistory  = (tableId) => api.get(`/billing/tables/${tableId}/history`)
export const closeBillingTable   = (tableId)       => api.post(`/billing/tables/${tableId}/close`)
export const billAllOrders       = (tableId, data) => api.post(`/billing/tables/${tableId}/bill-all`, data)
export const billingNewOrder      = (data)          => api.post('/billing/orders', data)
export const billingAddItems      = (orderId, data) => api.post(`/billing/orders/${orderId}/items`, data)
export const billingPlaceTakeaway = (data)          => api.post('/billing/takeaway/orders', data)
export const billingPlaceAggregator = (data)        => api.post('/billing/aggregator/orders', data)
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

// Owner — GMB (Google Business Profile)
export const getGmbStatus            = ()         => api.get('/owner/gmb/status')
export const getGmbConnectUrl        = ()         => api.get('/owner/gmb/connect')
export const disconnectGmb           = ()         => api.post('/owner/gmb/disconnect')
export const updateGmbSettings       = (data)     => api.put('/owner/gmb/settings', data)
export const getGmbAccounts          = ()         => api.get('/owner/gmb/accounts')
export const getGmbLocations         = (accountId) => api.get('/owner/gmb/locations', { params: { account_id: accountId } })
export const selectGmbLocation       = (data)     => api.post('/owner/gmb/select-location', data)
export const getGmbReviews           = (params)   => api.get('/owner/gmb/reviews', { params })
export const syncGmbReviews          = ()         => api.post('/owner/gmb/reviews/sync')
export const generateAiReviewReply   = (reviewId) => api.post(`/owner/gmb/reviews/${reviewId}/ai-reply`)
export const postGmbReply            = (reviewId, data) => api.post(`/owner/gmb/reviews/${reviewId}/reply`, data)
export const getGmbPosts             = (params)   => api.get('/owner/gmb/posts', { params })
export const generateGmbPostSuggestions = ()      => api.post('/owner/gmb/posts/generate')
export const publishGmbPost          = (postId)   => api.post(`/owner/gmb/posts/${postId}/publish`)
export const dismissGmbPost          = (postId)   => api.post(`/owner/gmb/posts/${postId}/dismiss`)
export const updateGmbPost           = (postId, data) => api.put(`/owner/gmb/posts/${postId}`, data)

// Public — Feedback submission
export const getFeedbackPage         = (token)    => api.get(`/public/feedback/${token}`)
export const submitFeedback          = (token, data) => api.post(`/public/feedback/${token}/submit`, data)
export const getAiSuggestions        = (token, data) => api.post(`/public/feedback/${token}/ai-suggestions`, data)

// Owner — Hotel Rooms
export const getRooms          = ()         => api.get('/owner/hotel/rooms')
export const getRoomQr         = (id)       => api.get(`/owner/hotel/rooms/${id}/qr`, { responseType: 'text' })
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
export const downloadBookingBill       = (id, paymentMethod, prefix = 'owner') => api.get(`/${prefix}/hotel/bookings/${id}/bill`, { params: { payment_method: paymentMethod }, responseType: 'blob' })

// Waiter — Room Service
export const getActiveRooms    = ()         => api.get('/waiter/room-service/active-rooms')
export const placeRoomService  = (data)     => api.post('/waiter/room-service/orders', data)

// Public (customer)
export const getPublicMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const placePublicOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
export const getCustomerMenu = (slug, token) => api.get(`/public/menu/${slug}/${token}`)
export const customerPlaceOrder = (slug, token, data) => api.post(`/public/menu/${slug}/${token}/order`, data)
// Room service QR menu (public)
export const getCustomerRoomMenu   = (slug, token)       => api.get(`/public/room/${slug}/${token}`)
export const customerPlaceRoomOrder = (slug, token, data) => api.post(`/public/room/${slug}/${token}/order`, data)
export const customerRequestBill    = (slug, token) => api.post(`/public/menu/${slug}/${token}/request-bill`)
export const customerCallWaiter     = (slug, token) => api.post(`/public/menu/${slug}/${token}/call-waiter`)
export const customerNotifyBillPaid = (slug, token) => api.post(`/public/menu/${slug}/${token}/notify-bill-paid`)
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

// Owner — outlet management (operational hours, per-channel on/off, offline reason)
export const getOutlet           = ()       => api.get('/owner/outlet')
export const toggleOutletChannel = (data)   => api.post('/owner/outlet/toggle-channel', data)
export const setOutletHours      = (data)   => api.put('/owner/outlet/hours', data)
export const getTenantSettings   = ()     => api.get('/tenant-settings')
export const setActiveContactPhone = (phone) => api.put('/settings/active-phone', { active_contact_phone: phone })
export const changeOwnPassword   = (data) => api.post('/owner/change-password', data)
