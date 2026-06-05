import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Home, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export default function OrderConfirmedPage() {
  const [params] = useSearchParams();
  const orders = params.get("orders") ?? "";
  const total = Number(params.get("total") ?? 0);
  const orderList = orders.split(",").filter(Boolean);

  return (
    <main className="min-h-[80dvh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
        <CheckCircle className="w-10 h-10 text-emerald-600" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-bold text-stone-900 mb-2">Order Confirmed!</h1>
      <p className="text-stone-500 text-lg mb-4 max-w-sm">Payment confirmed by the restaurant. Your order is now with the kitchen.</p>
      {orderList.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {orderList.map((num) => (
            <span key={num} className="flex items-center gap-1.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-full px-3 py-1.5">
              <Hash className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />{num}
            </span>
          ))}
        </div>
      )}
      {total > 0 && <p className="text-stone-500 text-sm mb-4">Total paid: <span className="font-semibold text-stone-900">{formatCurrency(total)}</span></p>}
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-4 py-2 mb-10">
        <Clock className="w-4 h-4" aria-hidden="true" />
        Estimated preparation: 20–30 minutes
      </div>
      <Link to="/"><Button variant="secondary"><Home className="w-4 h-4" />Back to Home</Button></Link>
    </main>
  );
}
