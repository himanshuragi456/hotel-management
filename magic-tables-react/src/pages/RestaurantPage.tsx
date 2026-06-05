import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MapPin, Phone, Users, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { TableCard } from "@/components/restaurant/table-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRestaurant, useTables } from "@/hooks/useRestaurants";
import { useCartStore } from "@/store/cart";
import { formatRating } from "@/lib/utils";
import { PRICE_LABELS } from "@/types";
import type { Table } from "@/types";

export default function RestaurantPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const { _hasHydrated, customerPhone, isTableLocked, tenantSlug: lockedSlug, tableId: lockedTableId, tableNumber: lockedTableNumber, tenantName: lockedTenantName } = useCartStore();
  const locked = _hasHydrated && isTableLocked();

  const { data: restaurant, isLoading: loadingRestaurant, isError: restaurantError } = useRestaurant(slug!);
  const { data: tables = [], isLoading: loadingTables, isError: tablesError, refetch: refetchTables, isFetching } = useTables(slug!);

  const freeTables = tables.filter((t) => t.status === "free").length;
  const isLoading = loadingRestaurant || loadingTables;

  if (locked && lockedSlug && lockedSlug !== slug) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">🔒</div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">Session active at {lockedTenantName}</h1>
        <p className="text-stone-500 text-sm mb-6">You have an active table session at another restaurant. Please finish your visit there first.</p>
        <Button onClick={() => navigate(`/restaurants/${lockedSlug}/${lockedTableId}`)}>Go back to my table</Button>
      </div>
    );
  }

  if (!isLoading && restaurantError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-2">Restaurant not found</h1>
        <Button variant="secondary" onClick={() => navigate("/")} className="mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to listings
        </Button>
      </div>
    );
  }

  return (
    <main className="pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm transition-colors duration-150 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="relative h-56 sm:h-72 lg:h-80 bg-stone-100 mt-4 overflow-hidden">
        {restaurant?.cover_image_url ? (
          <img src={restaurant.cover_image_url} alt={`${restaurant.name} cover`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-100 to-amber-100 flex items-center justify-center">
            <span className="text-7xl opacity-30" aria-hidden="true">🍽</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {restaurant && (
          <div className="absolute top-4 right-4">
            <Badge variant={restaurant.is_open ? "success" : "danger"} className="shadow-md">
              <span className={`w-1.5 h-1.5 rounded-full ${restaurant.is_open ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden="true" />
              {restaurant.is_open ? "Accepting Orders" : "Not Accepting Orders"}
            </Badge>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 -mt-8 relative z-10 p-6 mb-8">
          {loadingRestaurant ? (
            <div className="space-y-3">
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : restaurant ? (
            <>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h1 className="text-2xl font-bold text-stone-900">{restaurant.name}</h1>
                  <p className="text-stone-500 text-sm mt-0.5">{restaurant.cuisine_type ?? "Restaurant"} · {PRICE_LABELS[restaurant.price_range]}</p>
                </div>
                {restaurant.avg_rating > 0 && (
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1 text-amber-500 font-semibold">
                      <Star className="w-4 h-4 fill-amber-400 stroke-amber-400" aria-hidden="true" />
                      {formatRating(restaurant.avg_rating)}
                    </div>
                    <p className="text-xs text-stone-400">{restaurant.review_count} reviews</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-stone-500">
                {(restaurant.address || restaurant.city) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0" aria-hidden="true" />
                    {[restaurant.address, restaurant.city].filter(Boolean).join(", ")}
                  </span>
                )}
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 hover:text-rose-600 transition-colors duration-150">
                    <Phone className="w-4 h-4 text-rose-400 flex-shrink-0" aria-hidden="true" />
                    {restaurant.phone}
                  </a>
                )}
              </div>
              {!restaurant.qr_ordering_enabled && (
                <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  This restaurant is not accepting online orders right now. Walk in to order.
                </div>
              )}
            </>
          ) : null}
        </div>

        {restaurant?.qr_ordering_enabled && (
          <section aria-labelledby="tables-heading">
            {locked && lockedSlug === slug ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3" aria-hidden="true">🔒</div>
                <h2 className="text-lg font-bold text-stone-900 mb-1">You&apos;re locked to Table {lockedTableNumber}</h2>
                <p className="text-sm text-stone-500 mb-5">You have an active session at this table. You cannot select a different table.</p>
                <Button onClick={() => navigate(`/restaurants/${slug}/${lockedTableId}`)}>Go to my table</Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-rose-500" aria-hidden="true" />
                      <h2 id="tables-heading" className="text-xl font-bold text-stone-900">Table Availability</h2>
                    </div>
                    {!loadingTables && (
                      <p className="text-sm text-stone-500 mt-0.5">{freeTables} of {tables.length} tables free · refreshes every 30s</p>
                    )}
                  </div>
                  <button
                    onClick={() => refetchTables()}
                    disabled={isFetching}
                    className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors duration-150 cursor-pointer disabled:opacity-50"
                    aria-label="Refresh table availability"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
                    Refresh
                  </button>
                </div>

                {tablesError && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700 mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> Could not load table data. Please refresh.
                  </div>
                )}

                {loadingTables ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tables.map((table) => (
                      <TableCard
                        key={table.id}
                        table={table}
                        customerPhone={customerPhone}
                        onSelect={(t) => { setSelectedTable(t); navigate(`/restaurants/${slug}/${t.id}`); }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>

      {selectedTable && (
        <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center justify-between gap-6 bg-stone-900 text-white rounded-2xl px-5 py-4 shadow-2xl shadow-stone-900/30 w-full max-w-md">
            <div>
              <p className="text-xs text-stone-400">Selected</p>
              <p className="font-semibold">Table {selectedTable.table_number} · {selectedTable.capacity} seats</p>
            </div>
            <Button size="sm" onClick={() => navigate(`/restaurants/${slug}/${selectedTable.id}`)} className="flex-shrink-0">
              View Menu <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
