"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  getClientIp,
  hasAnyUser,
  hashPassword,
  isLockedOut,
  verifyPassword,
} from "@/lib/auth";
import { str } from "@/lib/action";

export type FormState = { error?: string } | undefined;

const GENERIC = "Sai tên đăng nhập hoặc mật khẩu";

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const remember = fd.get("remember") === "on";
  const ip = await getClientIp();

  if (!username || !password) return { error: GENERIC };
  if (await isLockedOut(username, ip)) {
    return { error: "Đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút." };
  }
  const user = await db.user.findUnique({ where: { username } });
  const ok = !!user && user.active && (await verifyPassword(user.passwordHash, password));
  await db.loginAttempt.create({ data: { username, ip, success: ok } });
  if (!ok || !user) return { error: GENERIC };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, remember);
  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function setupOwner(_: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username").toLowerCase();
  const fullName = str(fd, "fullName");
  const password = String(fd.get("password") ?? "");
  const spaName = str(fd, "spaName");

  if (!/^[a-z0-9._-]{3,32}$/.test(username))
    return { error: "Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu . _ -" };
  if (!fullName) return { error: "Nhập họ tên" };
  if (password.length < 8) return { error: "Mật khẩu tối thiểu 8 ký tự" };

  const passwordHash = await hashPassword(password);
  // Serializable so two simultaneous first-run submissions cannot both create an owner.
  const created = await db.$transaction(
    async (tx) => {
      if ((await tx.user.count()) > 0) return null;
      const u = await tx.user.create({ data: { username, fullName, passwordHash, role: "owner" } });
      if (spaName) {
        await tx.setting.upsert({
          where: { key: "spa_name" },
          create: { key: "spa_name", value: spaName },
          update: { value: spaName },
        });
      }
      return u;
    },
    { isolationLevel: "Serializable" },
  );
  if (!created) redirect("/login");
  await createSession(created.id, true);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function setupAvailable() {
  return !(await hasAnyUser());
}
