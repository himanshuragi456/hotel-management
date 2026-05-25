import Link from "next/link";
import Image from "next/image";
import { Star, Clock, Users, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRating, formatCurrency } from "@/lib/utils";
import type { Tenant } from "@/types";
import { PRICE_LABELS } from "@/types";

interface RestaurantCardProps {
  restaurant: Tenant;
}

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const {
    slug,
    name,
    cover_image_url,
    logo_url,
    cuisine_type,
    avg_rating,
    review_count,
    price_range,
    is_open,
    city,
    address,
  } = restaurant;

  return (
    <Link
      href={`/restaurants/${slug}`}
      className="group block rounded-2xl overflow-hidden border border-stone-100 bg-white hover:shadow-lg hover:shadow-stone-200/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      aria-label={`View ${name}`}
    >
      {/* Cover Image */}
      <div className="relative h-48 bg-stone-100 overflow-hidden">
        {cover_image_url ? (
          <Image
            src={cover_image_url}
            alt={`${name} cover`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-100 to-amber-100 flex items-center justify-center">
            <span className="text-4xl opacity-40" aria-hidden="true">🍽</span>
          </div>
        )}

        {/* Open/Closed badge */}
        <div className="absolute top-3 left-3">
          <Badge variant={is_open ? "success" : "danger"}>
            <span className={`w-1.5 h-1.5 rounded-full ${is_open ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden="true" />
            {is_open ? "Open" : "Closed"}
          </Badge>
        </div>

        {/* Logo */}
        {logo_url && (
          <div className="absolute bottom-3 right-3 w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md bg-white">
            <Image src={logo_url} alt={`${name} logo`} fill className="object-contain" sizes="40px" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-stone-900 text-base leading-tight group-hover:text-rose-600 transition-colors duration-150">
            {name}
          </h3>
          <p className="text-sm text-stone-500 mt-0.5">{cuisine_type ?? "Restaurant"}</p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 text-amber-500 font-medium">
            <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" aria-hidden="true" />
            <span>{formatRating(avg_rating)}</span>
            <span className="text-stone-400 font-normal">({review_count})</span>
          </div>
          <span className="text-stone-300">·</span>
          <span className="text-stone-500">{PRICE_LABELS[price_range]}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{address ?? city}</span>
        </div>
      </div>
    </Link>
  );
}
