import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateToStr, fmtDate, todayStr } from "@/lib/dates";

function csvCell(v: string) {
  return /[",;\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** GET /api/customers/export — owner only, UTF-8 CSV with BOM so Excel shows Vietnamese correctly. */
export async function GET() {
  const u = await apiUser(true);
  if (u instanceof Response) return u;
  const customers = await db.customer.findMany({ orderBy: { name: "asc" } });
  const lines = [
    ["Tên", "SĐT", "Ngày sinh", "Ghi chú", "Ngày tạo"].join(","),
    ...customers.map((c) =>
      [
        c.name,
        c.phone ?? "",
        c.birthday ? fmtDate(dateToStr(c.birthday)) : "",
        c.note ?? "",
        fmtDate(c.createdAt.toISOString().slice(0, 10)),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="khach-hang_${todayStr()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
