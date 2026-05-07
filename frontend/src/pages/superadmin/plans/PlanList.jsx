import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlans, deletePlan } from '@/services/superadminService'
import Modal from '@/components/shared/Modal'
import PlanForm from './PlanForm'

function ModuleTag({ active, label }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
      {label}
    </span>
  )
}

export default function PlanList() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const qc = useQueryClient()

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => getPlans().then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })

  const handleEdit = (plan) => { setEditing(plan); setShowForm(true) }
  const handleClose = () => { setShowForm(false); setEditing(null) }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Subscription Plans</h2>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Plan
        </button>
      </div>

      {isLoading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans?.map(plan => (
            <div key={plan.id} className={`bg-white rounded-xl border p-5 ${!plan.is_active ? 'opacity-60 border-dashed border-gray-300' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                </div>
                {!plan.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
              </div>

              <div className="mb-3">
                <span className="text-2xl font-bold text-gray-900">₹{plan.price_monthly}</span>
                <span className="text-sm text-gray-500">/mo</span>
                <span className="text-xs text-gray-400 ml-2">₹{plan.price_yearly}/yr</span>
              </div>

              <div className="flex gap-1 flex-wrap mb-3">
                <ModuleTag active={plan.module_restaurant} label="🍽 Restaurant" />
                <ModuleTag active={plan.module_hotel}      label="🏨 Hotel" />
                <ModuleTag active={plan.module_feedback}   label="⭐ Feedback" />
              </div>

              <div className="text-xs text-gray-500 mb-4 space-y-0.5">
                <div>Up to {plan.max_users} users</div>
                {plan.max_tables > 0 && <div>Up to {plan.max_tables} tables</div>}
                {plan.max_rooms  > 0 && <div>Up to {plan.max_rooms} rooms</div>}
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleEdit(plan)} className="text-blue-600 text-xs hover:underline">Edit</button>
                <button onClick={() => confirm(`Delete "${plan.name}"?`) && deleteMutation.mutate(plan.id)} className="text-red-500 text-xs hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={handleClose} title={editing ? 'Edit Plan' : 'New Plan'} size="lg">
        <PlanForm plan={editing} onSuccess={() => { handleClose(); qc.invalidateQueries({ queryKey: ['plans'] }) }} />
      </Modal>
    </div>
  )
}
