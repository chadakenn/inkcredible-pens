import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import Toast from './components/Toast'
import ScrollToTop from './components/ScrollToTop'
import NavProgress from './components/NavProgress'
import AnnouncementBar from './components/AnnouncementBar'
import Home from './pages/Home'
import { useCatalog } from './store/catalog'
import { useScents } from './store/scents'

const Shop = lazy(() => import('./pages/Shop'))
const CategoryPage = lazy(() => import('./pages/CategoryPage'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Favorites = lazy(() => import('./pages/Favorites'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminOrders = lazy(() => import('./pages/AdminOrders'))
const CustomLogoStickers = lazy(() => import('./pages/CustomLogoStickers'))
const CustomBanners = lazy(() => import('./pages/CustomBanners'))
const CustomCanvas = lazy(() => import('./pages/CustomCanvas'))
const CustomBusinessCards = lazy(() => import('./pages/CustomBusinessCards'))
const CustomThankYouCards = lazy(() => import('./pages/CustomThankYouCards'))
const CustomPhotoFreshie = lazy(() => import('./pages/CustomPhotoFreshie'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Contact = lazy(() => import('./pages/Contact'))
const ProofApproval = lazy(() => import('./pages/ProofApproval'))

function PageLoader() {
  return <div className="mx-auto flex min-h-[45vh] max-w-6xl items-center justify-center px-4"><div className="text-center"><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-line border-t-cyan" /><p className="mt-4 font-bold text-mute">Loading…</p></div></div>
}

function PageFade({ children }: { children: ReactNode }) {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <div key={location.pathname} className="animate-page-in">
      {children}
    </div>
  )
}

export default function App() {
  const hydrateCatalog = useCatalog((s) => s.hydrateFromApi)
  const hydrateScents = useScents((s) => s.hydrateFromApi)
  useEffect(() => {
    void hydrateCatalog()
    void hydrateScents()
  }, [hydrateCatalog, hydrateScents])

  return (
    <div className="noise-bg min-h-dvh flex flex-col">
      <NavProgress />
      <AnnouncementBar />
      <Header />
      <main className="flex-1">
        <PageFade>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/pens" element={<CategoryPage category="Pens" />} />
          <Route path="/stickers" element={<CategoryPage category="Stickers" />} />
          <Route path="/freshies" element={<CategoryPage category="Car Freshies" />} />
          <Route path="/canvas" element={<CategoryPage category="Canvas" />} />
          <Route path="/custom" element={<CategoryPage category="Custom" />} />
          <Route path="/custom/logo-stickers" element={<CustomLogoStickers />} />
          <Route path="/custom/banners" element={<CustomBanners />} />
          <Route path="/custom/canvas" element={<CustomCanvas />} />
          <Route path="/custom/business-cards" element={<CustomBusinessCards />} />
          <Route path="/custom/thank-you-cards" element={<CustomThankYouCards />} />
          <Route path="/custom/photo-freshie" element={<CustomPhotoFreshie />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/proof/:token" element={<ProofApproval />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </PageFade>
      </main>
      <Footer />
      <CartDrawer />
      <Toast />
      <ScrollToTop />
    </div>
  )
}
