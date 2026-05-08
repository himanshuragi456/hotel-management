import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

let _toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++_toastId
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const remove = (id) => setToasts(t => t.filter(x => x.id !== id))

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in cursor-pointer ${
              t.type === 'success' ? 'bg-green-600 text-white' :
              t.type === 'error'   ? 'bg-red-600 text-white'   :
              t.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-gray-900 text-white'
            }`}
          >
            <span>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => {
  const push = useContext(ToastCtx)
  return {
    success: (msg) => push(msg, 'success'),
    error:   (msg) => push(msg, 'error'),
    warning: (msg) => push(msg, 'warning'),
    info:    (msg) => push(msg, 'info'),
  }
}
