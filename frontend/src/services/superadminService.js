import api from './api'

// Tenants
export const getTenants = (params) => api.get('/superadmin/tenants', { params })
export const createTenant = (data) => api.post('/superadmin/tenants', data)
export const getTenant = (id) => api.get(`/superadmin/tenants/${id}`)
export const updateTenant = (id, data) => api.put(`/superadmin/tenants/${id}`, data)
export const deleteTenant = (id) => api.delete(`/superadmin/tenants/${id}`)
export const updateTenantModules = (id, data) => api.put(`/superadmin/tenants/${id}/modules`, data)
export const updateTenantAiSettings = (id, data) => api.put(`/superadmin/tenants/${id}/ai-settings`, data)
export const getTenantStats = (id) => api.get(`/superadmin/tenants/${id}/stats`)
export const loginAsTenant  = (tenant_id) => api.post('/auth/login-as', { tenant_id })
export const exportTenantData = (id) => api.get(`/superadmin/db/tenants/${id}/export`)

// Plans
export const getPlans = () => api.get('/superadmin/plans')
export const createPlan = (data) => api.post('/superadmin/plans', data)
export const updatePlan = (id, data) => api.put(`/superadmin/plans/${id}`, data)
export const deletePlan = (id) => api.delete(`/superadmin/plans/${id}`)

// Subscriptions
export const getSubscriptions = (params) => api.get('/superadmin/subscriptions', { params })
export const assignPlan = (tenantId, data) => api.post(`/superadmin/tenants/${tenantId}/assign-plan`, data)
export const extendSubscription = (id, data) => api.put(`/superadmin/subscriptions/${id}/extend`, data)
export const cancelSubscription = (id) => api.put(`/superadmin/subscriptions/${id}/cancel`)

// DB Stats
export const getDbOverview = () => api.get('/superadmin/db/overview')

// Audit Logs
export const getAuditLogs = (params) => api.get('/superadmin/audit-logs', { params })
export const purgeAuditLogs = (data) => api.delete('/superadmin/audit-logs/purge', { data })

// Branding
export const getBranding = () => api.get('/superadmin/branding')
export const updateBranding = (formData) => api.post('/superadmin/branding', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
