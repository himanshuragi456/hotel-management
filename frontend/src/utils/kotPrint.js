// Generates a KOT (Kitchen Order Ticket) and triggers browser print.
// Works by opening a minimal print window with no CSS dependencies.

export function printKot(order) {
  const location = order.table?.number
    ? `Table ${order.table.number}${order.table.section ? ' · ' + order.table.section : ''}`
    : order.room?.number
    ? `Room ${order.room.number}`
    : '—'

  const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

  const itemRows = (order.items ?? [])
    .map(i => {
      const group = i.category_name ?? i.menu_item?.category?.name
      const variant = i.variant_name
      const addons = Array.isArray(i.addons) ? i.addons : []
      const detailLines = []
      if (variant) detailLines.push(`<span style="font-size:12px;color:#000;font-weight:bold;">↳ ${esc(variant)}</span>`)
      addons.forEach(a => detailLines.push(`<span style="font-size:11px;color:#333;">+ ${esc(a.name)}</span>`))
      if (i.notes) detailLines.push(`<span style="font-size:11px;color:#666;">* ${esc(i.notes)}</span>`)
      const detail = detailLines.length ? `<br>${detailLines.join('<br>')}` : ''
      const groupLabel = group ? `<div style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1px;">${esc(group)}</div>` : ''
      return `
      <tr>
        <td style="padding:4px 6px;font-size:14px;font-weight:bold;vertical-align:top;">${i.quantity}</td>
        <td style="padding:4px 6px;font-size:13px;">${groupLabel}${esc(i.item_name)}${detail}</td>
      </tr>`
    })
    .join('')

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>KOT</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; width: 72mm; padding: 6px; }
  h1 { font-size:18px; text-align:center; letter-spacing:3px; margin-bottom:4px; }
  .sub { font-size:11px; text-align:center; color:#555; margin-bottom:8px; }
  .divider { border-top:1px dashed #000; margin:6px 0; }
  .location { font-size:16px; font-weight:bold; text-align:center; margin:6px 0; }
  table { width:100%; border-collapse:collapse; }
  th { font-size:11px; text-align:left; padding:3px 6px; border-bottom:1px solid #000; }
  .notes { font-size:12px; margin-top:6px; padding:4px 6px; border-top:1px dashed #000; }
  .footer { font-size:10px; text-align:center; margin-top:8px; color:#777; }
  @media print {
    @page { margin:0; size: 72mm auto; }
    body { padding:4px; }
  }
</style>
</head>
<body>
<h1>KOT</h1>
<p class="sub">${date} &nbsp; ${now}</p>
<div class="divider"></div>
<p class="location">${location}</p>
<p style="font-size:11px;text-align:center;color:#555;">${order.order_number ?? ''}</p>
<div class="divider"></div>
<table>
  <thead>
    <tr>
      <th style="width:28px">Qty</th>
      <th>Item</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>
${order.notes ? `<div class="notes"><strong>Note:</strong> ${order.notes}</div>` : ''}
<div class="divider"></div>
<p class="footer">Kitchen copy</p>
</body>
</html>`

  const win = window.open('', '_blank', 'width=320,height=500')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.onload = () => { win.print(); win.close() }
  // Fallback if onload doesn't fire
  setTimeout(() => { try { win.print(); win.close() } catch (_) {} }, 600)
}
