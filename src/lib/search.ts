import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { fold, normalizePhone } from "./format";

// Vietnamese diacritics → base letters, for accent-insensitive search without the unaccent extension.
const FROM =
  "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ" +
  "ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ";
const TO =
  "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd" +
  "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";

/** SQL fragment: folded (lowercase, no accents) version of a column. */
export function foldedSql(column: string) {
  return Prisma.raw(`lower(translate(${column}, '${FROM}', '${TO}'))`);
}

/** Customer ids matching a name (accent-insensitive) or phone fragment. */
export async function searchCustomerIds(q: string, limit = 50): Promise<number[]> {
  const term = q.trim();
  if (!term) return [];
  const f = `%${fold(term).replace(/[%_\\]/g, "")}%`;
  const digits = term.replace(/\D/g, "");
  const phone = digits.length >= 3 ? `%${normalizePhone(digits).replace(/^84/, "0")}%` : null;
  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM customers
     WHERE ${foldedSql("name")} LIKE ${f}
        ${phone ? Prisma.sql`OR phone LIKE ${phone}` : Prisma.empty}
     ORDER BY name
     LIMIT ${limit}`;
  return rows.map((r) => r.id);
}
