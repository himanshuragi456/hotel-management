"use client";

import Link from "next/link";
import { Heart, Home, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GoodbyePage() {
  return (
    <main className="min-h-[85dvh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-24 h-24 rounded-full bg-rose-100 flex items-center justify-center mb-6">
        <Heart className="w-12 h-12 text-rose-500 fill-rose-400" aria-hidden="true" />
      </div>

      <h1 className="text-3xl font-bold text-stone-900 mb-3">Thanks for visiting!</h1>
      <p className="text-stone-500 text-lg max-w-sm mb-2 leading-relaxed">
        Your table has been closed. We hope you had a great experience.
      </p>
      <p className="text-stone-400 text-sm mb-10">Come back anytime — your next order is just a tap away.</p>

      <div className="flex items-center gap-1.5 text-amber-500 mb-10">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className="w-6 h-6 fill-amber-400 stroke-amber-400" aria-hidden="true" />
        ))}
      </div>

      <Link href="/">
        <Button size="lg">
          <Home className="w-4 h-4" />
          Explore More Restaurants
        </Button>
      </Link>
    </main>
  );
}
