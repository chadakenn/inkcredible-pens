import type { Order } from '../store/orders'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function buildPackingSlipHtml(
  order: Order,
  itemMeta: (custom: Order['items'][number]['custom']) => string | null,
): string {
  const code = order.displayCode || order.id
  const ordered = new Date(order.createdAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const items = order.items.map((item) => {
    const meta = itemMeta(item.custom)
    const notes = [item.custom?.bannerNotes, item.custom?.canvasNotes, item.custom?.cardNotes]
      .filter(Boolean)
      .join(' · ')
    return `<li class="item">
      <span class="check"></span>
      <div><strong>${escapeHtml(item.qty)} × ${escapeHtml(item.name)}</strong>
        ${meta ? `<div class="detail">${escapeHtml(meta)}</div>` : ''}
        ${notes ? `<div class="notes"><b>Notes:</b> ${escapeHtml(notes)}</div>` : ''}
        ${item.custom?.logoComingByEmail ? '<div class="notes"><b>Artwork:</b> Customer will email artwork</div>' : ''}
      </div>
    </li>`
  }).join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Packing Slip ${escapeHtml(code)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#111;margin:0;padding:32px;background:#fff}
  .page{max-width:760px;margin:auto}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #111;padding-bottom:18px}
  h1{font-size:28px;margin:0}.brand{font-size:20px;font-weight:800}.muted{color:#555;font-size:13px;margin-top:5px}
  .ship{margin:24px 0;border:2px solid #111;border-radius:10px;padding:16px;line-height:1.5}.ship h2,.items h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 9px}
  ul{list-style:none;margin:0;padding:0}.item{display:grid;grid-template-columns:25px 1fr;gap:12px;border-top:1px solid #bbb;padding:15px 0;font-size:16px}
  .check{display:block;width:21px;height:21px;border:2px solid #111}.detail{font-size:14px;margin-top:4px}.notes{font-size:13px;margin-top:5px}
  .footer{border-top:2px solid #111;margin-top:24px;padding-top:18px;display:flex;justify-content:space-between;gap:20px;font-size:13px}
  .line{display:inline-block;min-width:180px;border-bottom:1px solid #111;height:18px}.print{margin:0 0 24px;padding:10px 18px;font-weight:700}
  @media print{body{padding:0}.print{display:none}.page{max-width:none}@page{margin:.55in}}
</style></head><body><div class="page">
  <button class="print" onclick="window.print()">Print packing slip</button>
  <div class="top"><div><div class="brand">Inkcredible Pens</div><div class="muted">Packing slip · no prices shown</div></div>
    <div><h1>Order ${escapeHtml(code)}</h1><div class="muted">Ordered ${escapeHtml(ordered)} ET</div></div></div>
  <section class="ship"><h2>Ship to</h2><strong>${escapeHtml(order.customer.name)}</strong><br>${escapeHtml(order.customer.address)}<br>${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} ${escapeHtml(order.customer.zip)}<div class="muted">${escapeHtml(order.customer.email)}</div></section>
  <section class="items"><h2>Items to pack (${order.items.reduce((sum, item) => sum + item.qty, 0)})</h2><ul>${items}</ul></section>
  <div class="footer"><span>Packed by: <span class="line"></span></span><span>Date: <span class="line"></span></span></div>
</div></body></html>`
}
