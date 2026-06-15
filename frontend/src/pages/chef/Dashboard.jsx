import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getKitchenOrders, updateOrderStatus, getTenantSettings, getRejectionReasons, rejectOrder } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import { printKot } from '@/utils/kotPrint'
import NotificationBell from '@/components/shared/NotificationBell'
import { useNotificationCenter } from '@/hooks/useNotificationCenter'
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

const PLATFORM_BADGE = {
  zomato: 'bg-[#e23744]/20 text-[#ff8088] ring-1 ring-[#e23744]/40',
  swiggy: 'bg-[#fc8019]/20 text-[#ffb072] ring-1 ring-[#fc8019]/40',
}

function OrderCard({ order, onStatusChange, showKotButton, onKotPrint, onReject }) {
  const next = STATUS_FLOW[order.status]

  return (
    <div
      className={`rounded-2xl border-l-4 p-4 transition-all duration-200 ${urgencyCardClass(order.elapsed_minutes, order.status)}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-bold text-lg leading-tight">
              {order.type === 'takeaway'
                ? `Takeaway`
                : order.table?.number
                ? `Table ${order.table.number}`
                : `Room ${order.room?.number ?? '—'}`}
            </span>
            {order.source === 'magic_tables' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40">
                Magic Tables
              </span>
            )}
            {order.source === 'aggregator' && order.platform ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${PLATFORM_BADGE[order.platform] ?? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40'}`}>
                {order.platform}{order.external_order_id ? ` · ${order.external_order_id}` : ''}
              </span>
            ) : order.type === 'takeaway' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40">
                Takeaway
              </span>
            )}
            {order.no_cutlery && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40">
                No cutlery
              </span>
            )}
          </div>
          {order.customer_name && (
            <div className="text-slate-400 text-xs mt-0.5">
              {order.customer_name}{order.customer_phone ? ` · ${order.customer_phone}` : ''}
            </div>
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
              {item.variant_name && (
                <div className="text-slate-400 text-xs mt-0.5">↳ {item.variant_name}</div>
              )}
              {item.addons?.length > 0 && (
                <div className="text-slate-400 text-xs mt-0.5">+ {item.addons.map(a => a.name).join(', ')}</div>
              )}
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
        {order.status !== 'ready' && onReject && (
          <button
            onClick={() => onReject(order)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-500/15 hover:bg-red-500/25 ring-1 ring-red-500/30 transition-colors"
          >
            Reject
          </button>
        )}
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

function RejectModal({ order, reasons, onClose, onConfirm, pending }) {
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [itemIds, setItemIds] = useState([])
  const reason = reasons?.find(r => r.code === code)
  const needsItems = reason?.requires_item

  const toggleItem = (id) => setItemIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const canSubmit = code && (!needsItems || itemIds.length > 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 ring-1 ring-white/10 rounded-2xl w-full max-w-md p-5">
        <h3 className="text-white font-bold mb-1">Reject order</h3>
        <p className="text-slate-400 text-xs mb-4 font-mono">{order.order_number}</p>

        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Reason</label>
        <select value={code} onChange={e => { setCode(e.target.value); setItemIds([]) }}
          className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500">
          <option value="">Select a reason…</option>
          {reasons?.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>

        {needsItems && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Out-of-stock item(s)</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {order.items?.map((it, i) => (
                <label key={i} className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={itemIds.includes(it.menu_item_id)} onChange={() => toggleItem(it.menu_item_id)}
                    className="rounded border-slate-600 text-red-500" />
                  {it.quantity}× {it.item_name}
                </label>
              ))}
            </div>
          </div>
        )}

        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
          rows={2} className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-xl">Cancel</button>
          <button
            disabled={!canSubmit || pending}
            onClick={() => onConfirm({ reason_code: code, note: note || undefined, rejected_item_ids: needsItems ? itemIds : undefined })}
            className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-40">
            {pending ? 'Rejecting…' : 'Reject Order'}
          </button>
        </div>
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

function Column({ title, colorClass, pillClass, count, orders, onStatusChange, emptyMessage, showKotButton, onKotPrint, onReject }) {
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
        <OrderCard key={o.id} order={o} onStatusChange={onStatusChange} showKotButton={showKotButton} onKotPrint={onKotPrint} onReject={onReject} />
      ))}
      {!orders.length && <EmptyColumn message={emptyMessage} />}
    </div>
  )
}

export default function ChefDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const knownOrderIds = useRef(new Set())

  // Central notification engine — rings new-KOT sound + drives the bell.
  const sound = useNotificationCenter({ extraInvalidateKeys: [['kitchen-orders']] })

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
    // Freshness is driven by Pusher (useNotificationCenter invalidates
    // 'kitchen-orders' on every order event). This is just a slow safety
    // backstop in case a websocket event is missed.
    refetchInterval: 60000,
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

  const [rejectTarget, setRejectTarget] = useState(null)
  const { data: rejectionReasons } = useQuery({
    queryKey: ['rejection-reasons'],
    queryFn: () => getRejectionReasons().then(r => r.data.data),
    staleTime: 60 * 60 * 1000, // reference data — rarely changes
  })
  const reject = useMutation({
    mutationFn: ({ id, data }) => rejectOrder(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kitchen-orders'] }); setRejectTarget(null) },
  })

  const handleLogout = async () => {
    try { await logoutApi() } catch { /* ignore */ }
    clearAuth()
    navigate('/login', { replace: true })
  }

  const pending   = orders?.filter(o => o.status === 'pending')   ?? []
  const preparing = orders?.filter(o => o.status === 'preparing') ?? []
  const ready     = orders?.filter(o => o.status === 'ready')     ?? []

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FireIcon className="w-6 h-6 text-orange-400" />
            <span className="text-white font-bold text-base tracking-tight">Kitchen</span>
          </div>
          {user?.name && (
            <span className="text-slate-500 text-sm hidden sm:block">{user.name}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stop sound — only while a KOT alert is ringing */}
          {sound.playing && (
            <button
              onClick={sound.stopSound}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40 hover:bg-orange-500/30 transition-colors animate-pulse"
            >
              <SpeakerXMarkIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}

          {/* Sound toggle (this device) */}
          <button
            onClick={sound.toggleMute}
            title={sound.muted ? 'Sound off' : 'Sound on'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !sound.muted
                ? 'bg-green-900/50 text-green-300 ring-1 ring-green-700/50 hover:bg-green-900/80'
                : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700 hover:bg-slate-700'
            }`}
          >
            {!sound.muted
              ? <SpeakerWaveIcon className="w-4 h-4" />
              : <SpeakerXMarkIcon className="w-4 h-4" />}
            <span className="hidden sm:inline">{!sound.muted ? 'Sound on' : 'Sound off'}</span>
          </button>

          {/* Notification bell */}
          <NotificationBell sound={sound} />

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
            onReject={setRejectTarget}
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
            onReject={setRejectTarget}
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
            onReject={setRejectTarget}
          />
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          order={rejectTarget}
          reasons={rejectionReasons}
          pending={reject.isPending}
          onClose={() => setRejectTarget(null)}
          onConfirm={(data) => reject.mutate({ id: rejectTarget.id, data })}
        />
      )}
    </div>
  )
}
