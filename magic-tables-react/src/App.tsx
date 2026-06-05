import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { FooterBranding } from "@/components/layout/footer-branding";
import HomePage from "@/pages/HomePage";
import RestaurantPage from "@/pages/RestaurantPage";
import MenuPage from "@/pages/MenuPage";
import CheckoutPage from "@/pages/CheckoutPage";
import GoodbyePage from "@/pages/GoodbyePage";
import OrderConfirmedPage from "@/pages/OrderConfirmedPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-dvh flex flex-col bg-stone-50 text-stone-900">
          <Navbar />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/restaurants/:slug" element={<RestaurantPage />} />
              <Route path="/restaurants/:slug/:tableId" element={<MenuPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/goodbye" element={<GoodbyePage />} />
              <Route path="/order-confirmed" element={<OrderConfirmedPage />} />
            </Routes>
          </div>
          <footer className="border-t border-stone-100 bg-white py-6 text-center text-sm text-stone-400">
            © {new Date().getFullYear()} Magic Tables
            <FooterBranding />
          </footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
