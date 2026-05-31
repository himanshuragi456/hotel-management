import { useQuery } from "@tanstack/react-query";
import { restaurantApi, orderApi } from "@/services/api";

export function useRestaurants(params?: { location_id?: number; search?: string }) {
  return useQuery({
    queryKey: ["restaurants", params],
    queryFn: () => restaurantApi.list(params),
    staleTime: 60_000,
  });
}

export function useRestaurant(slug: string) {
  return useQuery({
    queryKey: ["restaurant", slug],
    queryFn: () => restaurantApi.get(slug),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useTables(slug: string, refetchInterval = 30_000) {
  return useQuery({
    queryKey: ["tables", slug],
    queryFn: () => restaurantApi.tables(slug),
    enabled: !!slug,
    refetchInterval,
  });
}

export function useMenu(slug: string) {
  return useQuery({
    queryKey: ["menu", slug],
    queryFn: () => restaurantApi.menu(slug),
    enabled: !!slug,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: () => restaurantApi.cities(),
    staleTime: 10 * 60_000,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: () => restaurantApi.locations(),
    staleTime: 10 * 60_000,
  });
}

export function useMyOrders(slug: string, tableId: number | null, customerPhone: string) {
  return useQuery({
    queryKey: ["my-orders", slug, tableId, customerPhone],
    queryFn: () => orderApi.myOrders(slug, tableId!, customerPhone),
    enabled: !!slug && !!tableId && !!customerPhone,
    refetchInterval: 5_000,
    staleTime: 0,
  });
}
