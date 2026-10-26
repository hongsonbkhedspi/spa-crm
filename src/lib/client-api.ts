import type { ComboItem } from "@/components/ui/combobox";

export async function searchCustomers(q: string): Promise<ComboItem[]> {
  const r = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (r.status === 401) {
    window.location.href = "/login";
    return [];
  }
  return r.ok ? r.json() : [];
}
