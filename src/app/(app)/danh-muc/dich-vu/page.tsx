import { db } from "@/lib/db";
import { requireOwnerPage } from "@/lib/auth";
import { SimpleCatalog } from "../_components/simple-catalog";

export const metadata = { title: "Dịch vụ" };

export default async function ServicesPage() {
  await requireOwnerPage();
  const rows = await db.service.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <SimpleCatalog
      kind="service"
      rows={rows.map((r) => ({ id: r.id, name: r.name, price: r.price, days: r.recallDays, active: r.active }))}
    />
  );
}
