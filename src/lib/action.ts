import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

/** Runs a server-action body, turning thrown errors into a friendly result. */
export async function run<T>(fn: () => Promise<ActionResult<T> | void>): Promise<ActionResult<T>> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Dữ liệu bị trùng (ví dụ SĐT hoặc tên đăng nhập đã tồn tại)" };
    }
    if (e instanceof Error && (e.name === "UserError" || e.name === "ForbiddenError")) {
      return { ok: false, error: e.message };
    }
    console.error(e);
    return { ok: false, error: "Có lỗi xảy ra, hãy thử lại" };
  }
}

/** An error whose message is safe to show to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}

export function int(fd: FormData, key: string): number | null {
  const s = str(fd, key).replace(/[^\d-]/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
