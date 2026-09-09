import { Navigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/** Legacy route — orders now live as a tab inside Store Manager. */
export default function AdminOrders() {
  useDocumentTitle('Admin orders')
  return <Navigate to="/admin?tab=orders" replace />
}
