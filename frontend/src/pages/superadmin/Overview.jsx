import {
  BuildingOffice2Icon, CheckCircleIcon, BeakerIcon,
  NoSymbolIcon, UsersIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { getDbOverview } from '@/services/superadminService'

const CARDS = [
  { key: 'total_tenants',     label: 'Total Tenants',     Icon: BuildingOffice2Icon, gradient: 'from-blue-500 to-indigo-600',   bg: 'bg-blue-50',   text: 'text-blue-700'   },
  { key: 'active_tenants',    label: 'Active',            Icon: CheckCircleIcon,     gradient: 'from-emerald-500 to-teal-600',   bg: 'bg-emerald-50',text: 'text-emerald-700'},
  { key: 'trial_tenants',     label: 'In Trial',          Icon: BeakerIcon,          gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',  text: 'text-amber-700'  },
  { key: 'suspended_tenants', label: 'Suspended',         Icon: NoSymbolIcon,        gradient: 'from-rose-500 to-red-600',       bg: 'bg-rose-50',   text: 'text-rose-700'   },
  { key: 'total_users',       label: 'Total Users',       Icon: UsersIcon,           gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50', text: 'text-violet-700' },
  { key: 'total_audit_logs',  label: 'Audit Entries',     Icon: DocumentTextIcon,    gradient: 'from-slate-500 to-gray-600',     bg: 'bg-slate-100', text: 'text-slate-600'  },
]

export default function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ['db-overview'],
    queryFn: () => getDbOverview().then(r => r.data.data),
  })

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-xl font-semibold text-gray-900">Platform Overview</h2>
        <p className="text-sm text-gray-400 mt-0.5">Live stats across all tenants</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CARDS.map(({ key, label, Icon, bg, text }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
              <Icon className={`w-5 h-5 ${text}`} />
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            {isLoading ? (
              <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">{data?.[key] ?? 0}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
