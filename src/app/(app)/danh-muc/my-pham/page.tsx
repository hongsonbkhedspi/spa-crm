import { db } from "@/lib/db";
import { requireOwnerPage } from "@/lib/auth";
import { SimpleCatalog } from "../_components/simple-catalog";

export const metadata = { title: "Mỹ phẩm" };

export default async function ProductsPage() {
  await requireOwnerPage();
  const rows = await db.product.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <SimpleCatalog
      kind="product"
      rows={rows.map((r) => ({ id: r.id, name: r.name, price: r.price, days: r.usageDays, active: r.active }))}
    />
  );
}
