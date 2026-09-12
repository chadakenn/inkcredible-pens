import { ArrowLeft, Mail, PackageCheck, RotateCcw, Sparkles, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const EMAIL = 'inkcredible.pens@gmail.com'

export default function ShippingReturns() {
  useDocumentTitle('Shipping & Returns')

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-mute transition hover:text-cyan">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <p className="mt-6 text-xs font-extrabold uppercase tracking-wider text-pink">The practical stuff</p>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Shipping &amp; Returns</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute sm:text-base">
        Everything is packed by a real small business in Ohio. Here is what to expect after you order and what to do if something is not right.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="rounded-3xl border border-cyan/35 bg-ink-2 p-5 sm:p-6">
          <Truck className="h-7 w-7 text-cyan" />
          <h2 className="mt-3 font-display text-2xl text-cream">Shipping</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mute">
            <li><strong className="text-cream">United States:</strong> $8 flat-rate standard shipping.</li>
            <li><strong className="text-cream">Free shipping:</strong> Merchandise orders of $60 or more.</li>
            <li><strong className="text-cream">Tracking:</strong> We email tracking information when your order ships.</li>
          </ul>
        </article>

        <article className="rounded-3xl border border-lime/35 bg-ink-2 p-5 sm:p-6">
          <Sparkles className="h-7 w-7 text-lime" />
          <h2 className="mt-3 font-display text-2xl text-cream">Made to order</h2>
          <p className="mt-4 text-sm leading-relaxed text-mute">
            Many Inkcredible products are handmade or personalized. Production time varies by item and order size. Custom-project timing is confirmed with you before final production.
          </p>
        </article>
      </div>

      <div className="mt-8 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-7 w-7 text-pink" />
          <h2 className="font-display text-2xl text-cream">Returns</h2>
        </div>
        <div className="mt-5 space-y-5 text-sm leading-relaxed text-mute">
          <div>
            <h3 className="font-bold text-cream">Regular, non-custom products</h3>
            <p className="mt-1">Contact us within 14 days of delivery. Items must be unused and returned in their original condition. The customer is responsible for return shipping.</p>
          </div>
          <div>
            <h3 className="font-bold text-cream">Custom and personalized products</h3>
            <p className="mt-1">Custom or personalized items cannot be returned unless they arrive damaged, defective, or different from the approved order.</p>
          </div>
          <div>
            <h3 className="font-bold text-cream">Damage or order problems</h3>
            <p className="mt-1">Contact us within 7 days of delivery. Include your order number, a description of the problem, and clear photos so we can make it right.</p>
          </div>
          <div>
            <h3 className="font-bold text-cream">Refund timing</h3>
            <p className="mt-1">Approved refunds are returned to the original payment method. Your bank or card provider controls how quickly the credit appears.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-line bg-ink p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex gap-3">
          <PackageCheck className="mt-0.5 h-6 w-6 shrink-0 text-lime" />
          <div>
            <h2 className="font-display text-xl text-cream">Start a return or report a problem</h2>
            <p className="mt-1 text-sm text-mute">Include your order number so we can find the purchase quickly.</p>
          </div>
        </div>
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('Inkcredible order help')}`} className="btn-primary inline-flex min-h-12 shrink-0 justify-center">
          <Mail className="h-4 w-4" /> Email us
        </a>
      </div>
    </section>
  )
}
