import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/axios";

interface Branding {
  brand_name: string | null;
  brand_logo_url: string | null;
  sales_tagline: string | null;
}

function useBranding() {
  return useQuery<Branding>({
    queryKey: ["system-branding"],
    queryFn: () =>
      apiClient.get<{ status: boolean; data: Branding }>("/branding").then((r) => r.data.data),
    staleTime: Infinity,
    retry: false,
  });
}

export function FooterBranding() {
  const { data } = useBranding();
  const name = data?.brand_name;
  const logo = data?.brand_logo_url;
  if (!name && !logo) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-stone-300">·</span>
      <span>Powered by</span>
      {logo && <img src={logo} alt={name ?? "Platform"} width={16} height={16} className="inline-block rounded object-contain" />}
      {name && <span className="font-medium text-stone-500">{name}</span>}
    </span>
  );
}
