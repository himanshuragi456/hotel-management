"use client";

import { Users, Clock, CheckCircle, XCircle, Calendar, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Table } from "@/types";

interface TableCardProps {
  table: Table;
  /** Phone number the user has already used for a reservation on this table (if any) */
  customerPhone?: string;
  onSelect: (table: Table) => void;
}

export function TableCard({ table, customerPhone, onSelect }: TableCardProps) {
  const isFree = table.status === "free";

  // An occupied Magic Tables table where the same phone placed the original order → can add more batches
  const isMyReservation =
    table.status === "occupied" &&
    !!customerPhone &&
    table.reserved_by_phone === customerPhone;

  const canSelect = isFree || isMyReservation;

  const statusConfig = {
    free: {
      label: "Available",
      card: "bg-emerald-50 border-emerald-200 hover:shadow-md hover:shadow-emerald-100 hover:border-emerald-300",
      badge: "text-emerald-700 bg-emerald-100",
      icon: CheckCircle,
      iconColor: "text-emerald-500",
    },
    occupied: {
      label: "Occupied",
      card: "bg-stone-50 border-stone-200",
      badge: "text-stone-600 bg-stone-100",
      icon: XCircle,
      iconColor: "text-stone-400",
    },
    reserved: {
      label: isMyReservation ? "Your Reservation" : "Reserved",
      card: isMyReservation
        ? "bg-rose-50 border-rose-200 hover:shadow-md hover:shadow-rose-100 hover:border-rose-300"
        : "bg-amber-50 border-amber-200",
      badge: isMyReservation ? "text-rose-700 bg-rose-100" : "text-amber-700 bg-amber-100",
      icon: isMyReservation ? PlusCircle : Calendar,
      iconColor: isMyReservation ? "text-rose-500" : "text-amber-500",
    },
  };

  const config = statusConfig[table.status];
  const StatusIcon = config.icon;

  return (
    <div className={cn("rounded-2xl border-2 p-5 transition-all duration-200", config.card)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Table</p>
          <p className="text-2xl font-bold text-stone-900">{table.table_number}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.badge)}>
          <StatusIcon className={cn("w-3.5 h-3.5", config.iconColor)} aria-hidden="true" />
          {config.label}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-stone-500">
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4" aria-hidden="true" />
          {table.capacity} seats
        </span>
        {table.floor && (
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-stone-300" aria-hidden="true" />
            {table.floor}
          </span>
        )}
      </div>

      {table.occupied_since && !isFree && (
        <p className="flex items-center gap-1.5 text-xs text-stone-400 mb-4">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          Since {new Date(table.occupied_since).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      {isMyReservation && (
        <p className="text-xs text-rose-600 mb-3 font-medium">
          You already have items here — add another batch
        </p>
      )}

      <Button
        size="sm"
        className="w-full"
        variant={isMyReservation ? "secondary" : "primary"}
        disabled={!canSelect}
        onClick={() => canSelect && onSelect(table)}
        aria-disabled={!canSelect}
      >
        {isFree ? "Select Table" : isMyReservation ? "Add More Items" : "Unavailable"}
      </Button>
    </div>
  );
}
