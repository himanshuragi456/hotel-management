import { useEffect, useRef } from 'react'

function scrollToEl(el) {
  // Walk up to find the nearest scrollable ancestor (handles modals with overflow-y-auto)
  let node = el.parentElement
  while (node && node !== document.body) {
    const { overflow, overflowY } = window.getComputedStyle(node)
    if (/auto|scroll/.test(overflow + overflowY) && node.scrollHeight > node.clientHeight) {
      const top = el.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop - 16
      node.scrollTo({ top, behavior: 'smooth' })
      return
    }
    node = node.parentElement
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function useScrollToFirstError(fieldErrors, trigger = 0) {
  const ref = useRef(null)

  useEffect(() => {
    if (!fieldErrors || !Object.values(fieldErrors).some(Boolean)) return
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector('.border-red-400')
      if (el) scrollToEl(el)
    })
  }, [fieldErrors, trigger])

  return ref
}

export { scrollToEl }
