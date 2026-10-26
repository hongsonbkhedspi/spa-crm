"use server";
import { revalidatePath } from "next/cache";
import readXlsxFile from "read-excel-file/node";
import { db } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { fold, isValidPhone, normalizePhone } from "@/lib/format";
import { isDateStr, strToDate } from "@/lib/dates";

export type CustomerInput = {
  name: string;
  phone: string;
  birthday?: string | null;
  note?: string | null;
};

function clean(input: CustomerInput) {
  const name = input.name.normalize("NFC").trim();
  // Phone is optional; when given it must be valid and unique
  const phone = normalizePhone(input.phone ?? "") || null;
  if (!name) throw new UserError("Nhập tên khách");
  if (phone && !isValidPhone(phone)) throw new UserError("SĐT không hợp lệ");
  const birthday = input.birthday && isDateStr(input.birthday) ? strToDate(input.birthday) : null;
  const note = input.note?.normalize("NFC").trim() || null;
  return { name, phone, birthday, note };
}

async function assertPhoneFree(phone: string | null, exceptId?: number) {
  if (!phone) return;
  const existing = await db.customer.findUnique({ where: { phone } });
  if (existing && existing.id !== exceptId) throw new UserError(`SĐT này đã có: ${existing.name}`);
}

export async function createCustomer(input: CustomerInput): Promise<ActionResult<{ id: number }>> {
  return run(async () => {
    await requireUser();
    const data = clean(input);
    await assertPhoneFree(data.phone);
    const c = await db.customer.create({ data });
    revalidatePath("/khach-hang");
    return { ok: true, data: { id: c.id } };
  });
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<ActionResult> {
  return run(async () => {
    await requireUser();
    const data = clean(input);
    await assertPhoneFree(data.phone, id);
    await db.customer.update({ where: { id }, data });
    revalidatePath("/khach-hang");
    revalidatePath(`/khach-hang/${id}`);
  });
}

/** Owner only; refused if the customer has any visit, sale, package or appointment. */
export async function deleteCustomer(id: number): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    const [visits, sales, packages, appts] = await Promise.all([
      db.visit.count({ where: { customerId: id } }),
      db.productSale.count({ where: { customerId: id } }),
      db.customerPackage.count({ where: { customerId: id } }),
      db.appointment.count({ where: { customerId: id } }),
    ]);
    if (visits + sales + packages + appts > 0) {
      throw new UserError("Khách đã có lượt ghi nhận, gói, mỹ phẩm hoặc lịch hẹn nên không xoá được");
    }
    await db.$transaction([
      db.campaignRecipient.deleteMany({ where: { customerId: id } }),
      db.customer.delete({ where: { id } }),
    ]);
    revalidatePath("/khach-hang");
  });
}

// ---------------------------------------------------------------------------
// Import from CSV / Excel
// ---------------------------------------------------------------------------

export type ImportResult = {
  added: number;
  skipped: { row: number; name: string; phone: string; reason: string }[];
};

// Server actions accept bodies up to 1 MB by default (next.config serverActions.bodySizeLimit).
const MAX_BYTES = 950 * 1024;

export async function importCustomers(fd: FormData): Promise<ActionResult<ImportResult>> {
  return run(async () => {
    await requireOwner();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Chọn file CSV hoặc Excel");
    if (file.size > MAX_BYTES) throw new UserError("File quá lớn (tối đa 1 MB, khoảng 20.000 khách)");
    const buf = Buffer.from(await file.arrayBuffer());
    const lower = file.name.toLowerCase();

    let rows: string[][];
    if (lower.endsWith(".xlsx")) {
      const raw = await readXlsxFile(buf);
      rows = raw.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))));
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      rows = parseCsv(buf.toString("utf8"));
    } else {
      throw new UserError("Chỉ nhận file .csv hoặc .xlsx");
    }

    const { cols, start } = detectColumns(rows);
    const existing = new Set((await db.customer.findMany({ select: { phone: true } })).map((c) => c.phone));
    const seen = new Set<string>();
    const result: ImportResult = { added: 0, skipped: [] };
    const toCreate: { name: string; phone: string; note: string | null }[] = [];

    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[cols.name] ?? "").normalize("NFC").trim();
      const rawPhone = (r[cols.phone] ?? "").trim();
      const note = cols.note >= 0 ? (r[cols.note] ?? "").normalize("NFC").trim() || null : null;
      if (!name && !rawPhone) continue;
      // Excel may turn 0901234567 into the number 901234567.
      let phone = normalizePhone(rawPhone);
      if (/^[1-9]\d{8}$/.test(phone)) phone = "0" + phone;
      const skip = (reason: string) => result.skipped.push({ row: i + 1, name, phone: rawPhone, reason });
      if (!name) skip("Thiếu tên");
      else if (!isValidPhone(phone)) skip("SĐT không hợp lệ");
      else if (existing.has(phone)) skip("SĐT đã có trong danh sách khách");
      else if (seen.has(phone)) skip("SĐT bị lặp trong file");
      else {
        seen.add(phone);
        toCreate.push({ name, phone, note });
      }
    }

    if (toCreate.length) {
      const r = await db.customer.createMany({ data: toCreate, skipDuplicates: true });
      result.added = r.count;
    }
    revalidatePath("/khach-hang");
    return { ok: true, data: result };
  });
}

function detectColumns(rows: string[][]) {
  const header = (rows[0] ?? []).map((h) => fold(h).trim());
  const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const name = find("ten", "ho ten", "name");
  const phone = find("sdt", "so dien thoai", "dien thoai", "phone", "dt");
  const note = find("ghi chu", "note");
  if (name >= 0 && phone >= 0) return { cols: { name, phone, note }, start: 1 };
  return { cols: { name: 0, phone: 1, note: 2 }, start: 0 };
}

/** Minimal RFC 4180 CSV parser; accepts comma or semicolon (Excel VN locale), strips BOM. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
