import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, CheckCircleIcon,
  XCircleIcon, UsersIcon, TableCellsIcon, BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import { getPlans, deletePlan } from '@/services/superadminService'
import Modal from '@/components/shared/Modal'
import PlanForm from './PlanForm'

function ModuleChip({ active, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400 line-through'}`}>
      {active
        ? <CheckCircleIcon className="w-3 h-3" />
        : <XCircleIcon className="w-3 h-3" />}
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
      <div className="flex items-center justify-between mb-7">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Subscription Plans</h2>
          <p className="text-sm text-gray-400 mt-0.5">Define pricing tiers and module access</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
          <PlusIcon className="w-4 h-4" />
          New Plan
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans?.map(plan => (
            <div key={plan.id} className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${!plan.is_active ? 'opacity-60 border-dashed border-gray-200' : 'border-gray-100'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{plan.name}</h3>
                    {plan.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{plan.description}</p>}
                  </div>
                  {!plan.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactive</span>
                  )}
                </div>

                <div className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">₹{plan.price_monthly}</span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">₹{plan.price_yearly}/yr · save {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}%</p>
                </div>

                <div className="flex gap-1.5 flex-wrap mb-4">
                  <ModuleChip active={plan.module_restaurant} label="Restaurant" />
                  <ModuleChip active={plan.module_hotel}      label="Hotel" />
                  <ModuleChip active={plan.module_feedback}   label="Feedback" />
                </div>

                <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <UsersIcon className="w-3.5 h-3.5 text-gray-400" />
                    Up to {plan.max_users} users
                  </div>
                  {plan.max_tables > 0 && (
                    <div className="flex items-center gap-1.5">
                      <TableCellsIcon className="w-3.5 h-3.5 text-gray-400" />
                      Up to {plan.max_tables} tables
                    </div>
                  )}
                  {plan.max_rooms > 0 && (
                    <div className="flex items-center gap-1.5">
                      <BuildingOfficeIcon className="w-3.5 h-3.5 text-gray-400" />
                      Up to {plan.max_rooms} rooms
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <button onClick={() => handleEdit(plan)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                  <PencilSquareIcon className="w-3.5 h-3.5" />Edit
                </button>
                <button onClick={() => confirm(`Delete "${plan.name}"?`) && deleteMutation.mutate(plan.id)}
                  className="inline-flex items-center gap-1 text-xs text-red-500 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                  <TrashIcon className="w-3.5 h-3.5" />Delete
                </button>
              </div>
            </div>
          ))}

          {plans?.length === 0 && (
            <div className="col-span-3 py-20 text-center">
              <p className="text-gray-400">No plans yet. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      <Modal open={showForm} onClose={handleClose} title={editing ? 'Edit Plan' : 'New Plan'} size="lg">
        <PlanForm plan={editing} onSuccess={() => { handleClose(); qc.invalidateQueries({ queryKey: ['plans'] }) }} />
      </Modal>
    </div>
  )
}
