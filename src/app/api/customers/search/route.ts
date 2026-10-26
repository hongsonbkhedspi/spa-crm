import { NextRequest } from "next/server";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtPhone } from "@/lib/format";
import { searchCustomerIds } from "@/lib/search";

/** GET /api/customers/search?q=… — accent-insensitive name or phone fragment. */
export async function GET(req: NextRequest) {
  const u = await apiUser();
  if (u instanceof Response) return u;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const rows = q
    ? await db.customer.findMany({
        where: { id: { in: await searchCustomerIds(q, 12) } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true },
      })
    : await db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, phone: true } });
  return Response.json(rows.map((c) => ({ value: c.id, label: c.name, sub: fmtPhone(c.phone), keywords: c.phone ?? undefined })));
}
