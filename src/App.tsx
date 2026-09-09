import { useEffect, type ReactNode } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import Toast from './components/Toast'
import ScrollToTop from './components/ScrollToTop'
import NavProgress from './components/NavProgress'
import AnnouncementBar from './components/AnnouncementBar'
import Home from './pages/Home'
import Shop from './pages/Shop'
import CategoryPage from './pages/CategoryPage'
import ProductDetail from './pages/ProductDetail'
import Checkout from './pages/Checkout'
import Favorites from './pages/Favorites'
import Admin from './pages/Admin'
import AdminOrders from './pages/AdminOrders'
import CustomLogoStickers from './pages/CustomLogoStickers'
import CustomBanners from './pages/CustomBanners'
import CustomCanvas from './pages/CustomCanvas'
import CustomBusinessCards from './pages/CustomBusinessCards'
import CustomThankYouCards from './pages/CustomThankYouCards'
import SearchPage from './pages/SearchPage'
import NotFound from './pages/NotFound'
import Contact from './pages/Contact'
import { useCatalog } from './store/catalog'
import { useScents } from './store/scents'

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/pens" element={<CategoryPage category="Pens" />} />
          <Route path="/stickers" element={<CategoryPage category="Stickers" />} />
          <Route path="/freshies" element={<CategoryPage category="Car Freshies" />} />
          <Route path="/custom" element={<CategoryPage category="Custom" />} />
          <Route path="/custom/logo-stickers" element={<CustomLogoStickers />} />
          <Route path="/custom/banners" element={<CustomBanners />} />
          <Route path="/custom/canvas" element={<CustomCanvas />} />
          <Route path="/custom/business-cards" element={<CustomBusinessCards />} />
          <Route path="/custom/thank-you-cards" element={<CustomThankYouCards />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </PageFade>
      </main>
      <Footer />
      <CartDrawer />
      <Toast />
      <ScrollToTop />
    </div>
  )
}
