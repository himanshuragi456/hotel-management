import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, TrendingUp, Sparkles, AlertCircle, Lock } from "lucide-react";
import { RestaurantCard } from "@/components/restaurant/restaurant-card";
import { RestaurantCardSkeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/search/search-bar";
import { CuisineFilterBar } from "@/components/search/cuisine-filter";
import { useRestaurants, useLocations } from "@/hooks/useRestaurants";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import type { CuisineFilter } from "@/types";

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<CuisineFilter>("All");

  const { isTableLocked, tenantSlug, tableId, tenantName, tableNumber, clearCart, pendingOrder, billAwaitingConfirm, _hasHydrated } = useCartStore();
  const locked = _hasHydrated && isTableLocked();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (pendingOrder) { navigate("/checkout", { replace: true }); return; }
    if (billAwaitingConfirm && tenantSlug && tableId) {
      navigate(`/restaurants/${tenantSlug}/${tableId}`, { replace: true });
    }
  }, [_hasHydrated, pendingOrder, billAwaitingConfirm, tenantSlug, tableId, navigate]);

  const { data: locations = [] } = useLocations();
  const { data: allRestaurants = [], isLoading, isError } = useRestaurants({
    location_id: selectedLocationId ?? undefined,
    search: search || undefined,
  });

  const restaurants = useMemo(() => {
    if (selectedCuisine === "All") return allRestaurants;
    return allRestaurants.filter((r) => r.cuisine_type?.toLowerCase() === selectedCuisine.toLowerCase());
  }, [allRestaurants, selectedCuisine]);

  const featured = useMemo(() => restaurants.filter((r) => r.is_open).slice(0, 3), [restaurants]);
  const showFeatured = !search && selectedCuisine === "All" && featured.length > 0;

  if (locked && tenantSlug && tableId) {
    return (
      <main className="min-h-[80dvh] flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-rose-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">You&apos;re seated at {tenantName}</h1>
        <p className="text-stone-500 mb-1">Table {tableNumber}</p>
        <p className="text-sm text-stone-400 mb-8 max-w-xs">Your session is active. You can order more items or check your order status.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" className="w-full" onClick={() => navigate(`/restaurants/${tenantSlug}/${tableId}`)}>
            Back to Menu &amp; Orders
          </Button>
          <button onClick={() => clearCart()} className="text-xs text-stone-400 hover:text-red-500 transition-colors mt-2">
            End session &amp; browse other restaurants
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="bg-gradient-to-br from-rose-50 via-white to-amber-50 border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-rose-100 text-rose-700 rounded-full px-3 py-1.5 text-sm font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Book before you arrive
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight leading-tight mb-4">
              Find a table, <span className="text-rose-600">order ahead</span>
            </h1>
            <p className="text-stone-500 text-lg leading-relaxed">
              Browse restaurants near you, check live table availability, and place your order before you arrive.
            </p>
          </div>
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-shrink-0">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" aria-hidden="true" />
                <select
                  value={selectedLocationId ?? ""}
                  onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : null)}
                  className="h-14 pl-9 pr-4 rounded-2xl bg-white border border-stone-200 text-stone-800 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none cursor-pointer"
                  aria-label="Select location"
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}{loc.city ? ` · ${loc.city}` : ""}</option>
                  ))}
                </select>
              </div>
              <SearchBar value={search} onChange={setSearch} className="flex-1" />
            </div>
            <CuisineFilterBar selected={selectedCuisine} onChange={setSelectedCuisine} />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-14">
        {isError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            Could not load restaurants. Please check your connection and try again.
          </div>
        )}

        {!isLoading && !isError && restaurants.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4" aria-hidden="true">🔍</div>
            <h2 className="text-xl font-semibold text-stone-800 mb-2">No restaurants found</h2>
            <p className="text-stone-500">Try adjusting your search or filters</p>
          </div>
        )}

        {showFeatured && (
          <section aria-labelledby="featured-heading">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-amber-500" aria-hidden="true" />
              <h2 id="featured-heading" className="text-xl font-bold text-stone-900">Open Now</h2>
            </div>
            <p className="text-sm text-stone-500 mb-5">Accepting orders right now</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
            </div>
          </section>
        )}

        {(isLoading || restaurants.length > 0) && (
          <section aria-labelledby="all-heading">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-rose-500" aria-hidden="true" />
              <h2 id="all-heading" className="text-xl font-bold text-stone-900">
                {search || selectedCuisine !== "All" ? "Results" : "All Restaurants"}
              </h2>
            </div>
            {!isLoading && <p className="text-sm text-stone-500 mb-5">{restaurants.length} {restaurants.length === 1 ? "place" : "places"} found</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <RestaurantCardSkeleton key={i} />)
                : restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
