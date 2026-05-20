import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getKitchenOrders, updateOrderStatus, getTenantSettings } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import Pusher from 'pusher-js'
import { printKot } from '@/utils/kotPrint'
import {
  ClockIcon,
  FireIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  SparklesIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline'

const STATUS_FLOW = { pending: 'preparing', preparing: 'ready' }
const STATUS_LABEL = { pending: 'Start Preparing', preparing: 'Mark Ready' }

const urgencyStyle = (mins, status) => {
  if (status === 'ready') return 'border-green-500 bg-green-950'
  if (mins > 30) return 'border-red-500 bg-red-950'
  if (mins > 15) return 'border-yellow-500 bg-yellow-950'
  return 'border-blue-500 bg-gray-900'
}

const urgencyCardClass = (mins, status) => {
  if (status === 'ready')  return 'border-green-500 bg-white/5 backdrop-blur-sm border border-white/10'
  if (mins > 30)           return 'border-red-500 bg-red-950/60'
  if (mins > 15)           return 'border-yellow-500 bg-yellow-950/60'
  return 'border-blue-500 bg-slate-800/60'
}

function StatusPill({ status }) {
  const map = {
    pending:   'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40',
    preparing: 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40',
    ready:     'bg-green-500/20 text-green-300 ring-1 ring-green-500/40',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? ''}`}>
      {status}
    </span>
  )
}

function OrderCard({ order, onStatusChange, showKotButton, onKotPrint }) {
  const next = STATUS_FLOW[order.status]

  return (
    <div
      className={`rounded-2xl border-l-4 p-4 transition-all duration-200 ${urgencyCardClass(order.elapsed_minutes, order.status)}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-white font-bold text-lg leading-tight">
            {order.type === 'takeaway'
              ? `🛍️ Takeaway`
              : order.table?.number
              ? `Table ${order.table.number}`
              : `Room ${order.room?.number ?? '—'}`}
          </span>
          {order.type === 'takeaway' && order.customer_name && (
            <div className="text-slate-400 text-xs mt-0.5">{order.customer_name}{order.customer_phone ? ` · ${order.customer_phone}` : ''}</div>
          )}
          <div className="text-slate-500 text-xs mt-0.5 font-mono">{order.order_number}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill status={order.status} />
          <div className={`flex items-center gap-1 text-xs font-mono ${order.elapsed_minutes > 30 ? 'text-red-400' : 'text-slate-400'}`}>
            <ClockIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{order.elapsed_label} ago</span>
          </div>
          {order.kitchen_label && (
            <div className={`flex items-center gap-1 text-xs font-mono ${order.kitchen_minutes > 15 ? 'text-orange-400' : 'text-blue-400'}`}>
              <FireIcon className="w-3.5 h-3.5 shrink-0" />
              <span>In kitchen {order.kitchen_label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2 mb-4">
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md bg-orange-500/20 text-orange-400 font-bold text-xs ring-1 ring-orange-500/30">
              {item.quantity}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm leading-snug">{item.item_name}</div>
              {item.notes && (
                <div className="flex items-center gap-1 mt-1 px-2 py-1 rounded-md bg-amber-500/15 ring-1 ring-amber-500/30">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300 text-xs italic leading-snug">{item.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order-level note */}
      {order.notes && (
        <div className="flex items-start gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
          <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200 text-xs italic">{order.notes}</span>
        </div>
      )}

      {/* Buttons row */}
      <div className={`flex gap-2 ${next ? '' : 'justify-end'}`}>
        {showKotButton && (
          <button
            onClick={() => onKotPrint(order)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-700/60 hover:bg-slate-700 transition-colors"
          >
            <PrinterIcon className="w-3.5 h-3.5" />KOT
          </button>
        )}
        {next && (
          <button
            onClick={() => onStatusChange(order.id, next)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75 ${
              next === 'preparing'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-500'
            }`}
          >
            {next === 'ready' && (
              <CheckCircleIcon className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            )}
            {STATUS_LABEL[order.status]}
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyColumn({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-slate-800 text-slate-600">
      <SparklesIcon className="w-8 h-8 mb-2 opacity-40" />
      <span className="text-sm">{message}</span>
    </div>
  )
}

function Column({ title, colorClass, pillClass, count, orders, onStatusChange, emptyMessage, showKotButton, onKotPrint }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${colorClass}`}>
        <h2 className="flex-1 font-semibold uppercase text-xs tracking-widest">{title}</h2>
        <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-2 rounded-full text-xs font-bold ${pillClass}`}>
          {count}
        </span>
      </div>

      {/* Cards */}
      {orders.map(o => (
        <OrderCard key={o.id} order={o} onStatusChange={onStatusChange} showKotButton={showKotButton} onKotPrint={onKotPrint} />
      ))}
      {!orders.length && <EmptyColumn message={emptyMessage} />}
    </div>
  )
}

export default function ChefDashboard() {
  const { user, logout: clearAuth, getTenantId } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const audioRef = useRef(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const tenantId = getTenantId?.()
  const knownOrderIds = useRef(new Set())

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => getTenantSettings().then(r => r.data.data),
    staleTime: 60000,
  })

  const kotEnabled   = settings?.kot_enabled   ?? false
  const kotAutoPrint = settings?.kot_auto_print ?? false
  const kotPrinter   = settings?.kot_printer    ?? 'kitchen'
  const showKotButton = kotEnabled && kotPrinter === 'kitchen'

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: () => getKitchenOrders().then(r => r.data.data),
    refetchInterval: 15000,
  })

  // Auto-print KOT for new pending orders when setting is on
  useEffect(() => {
    if (!orders || !kotEnabled || !kotAutoPrint || kotPrinter !== 'kitchen') return
    const newOrders = orders.filter(o => o.status === 'pending' && !knownOrderIds.current.has(o.id))
    newOrders.forEach(o => {
      knownOrderIds.current.add(o.id)
      printKot(o)
    })
    // Also register already-known orders so we don't reprint on next poll
    orders.forEach(o => knownOrderIds.current.add(o.id))
  }, [orders, kotEnabled, kotAutoPrint, kotPrinter])

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kitchen-orders'] }),
  })

  // Pusher realtime
  useEffect(() => {
    if (!tenantId) return

    const pusherConfig = {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'mt1',
    }
    if (import.meta.env.VITE_PUSHER_HOST) {
      pusherConfig.wsHost = import.meta.env.VITE_PUSHER_HOST
      pusherConfig.wsPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      pusherConfig.wssPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      pusherConfig.forceTLS = (import.meta.env.VITE_PUSHER_SCHEME ?? 'http') === 'https'
      pusherConfig.disableStats = true
      pusherConfig.enabledTransports = ['ws']
    }
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, pusherConfig)

    const channel = pusher.subscribe(`tenant.${tenantId}.kitchen`)
    channel.bind('order.updated', () => {
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
      if (soundEnabled && audioRef.current) {
        audioRef.current.play().catch(() => {})
      }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.kitchen`)
    }
  }, [tenantId, soundEnabled, qc])

  const handleLogout = async () => {
    try { await logoutApi() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  const pending   = orders?.filter(o => o.status === 'pending')   ?? []
  const preparing = orders?.filter(o => o.status === 'preparing') ?? []
  const ready     = orders?.filter(o => o.status === 'ready')     ?? []

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hidden audio ping */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/ding.wav" type="audio/wav" />
      </audio>

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          {/* Brand mark */}
          <div className="flex items-center gap-2">
            <FireIcon className="w-6 h-6 text-orange-400" />
            <span className="text-white font-bold text-base tracking-tight">Kitchen</span>
          </div>

          {/* Operator name */}
          {user?.name && (
            <span className="text-slate-500 text-sm hidden sm:block">{user.name}</span>
          )}

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(s => !s)}
            title={soundEnabled ? 'Sound on' : 'Sound off'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              soundEnabled
                ? 'bg-green-900/50 text-green-300 ring-1 ring-green-700/50 hover:bg-green-900/80'
                : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700 hover:bg-slate-700'
            }`}
          >
            {soundEnabled
              ? <SpeakerWaveIcon className="w-4 h-4" />
              : <SpeakerXMarkIcon className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound on' : 'Sound off'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-red-400 ring-1 ring-red-900/50 bg-red-950/30 hover:bg-red-950/60 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-slate-500">
            <ClockIcon className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading orders…</span>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          <Column
            title="Pending"
            colorClass="bg-yellow-500/10 text-yellow-400"
            pillClass="bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40"
            count={pending.length}
            orders={pending}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            emptyMessage="No pending orders"
            showKotButton={showKotButton}
            onKotPrint={printKot}
          />

          <Column
            title="Preparing"
            colorClass="bg-blue-500/10 text-blue-400"
            pillClass="bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40"
            count={preparing.length}
            orders={preparing}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            emptyMessage="Nothing being prepared"
            showKotButton={showKotButton}
            onKotPrint={printKot}
          />

          <Column
            title="Ready"
            colorClass="bg-green-500/10 text-green-400"
            pillClass="bg-green-500/20 text-green-300 ring-1 ring-green-500/40"
            count={ready.length}
            orders={ready}
            onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            emptyMessage="Nothing ready yet"
            showKotButton={showKotButton}
            onKotPrint={printKot}
          />
        </div>
      )}
    </div>
  )
}
