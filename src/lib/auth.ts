import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import type { Role } from "@prisma/client";
import { db } from "./db";

export const SESSION_COOKIE = "spa_session";
const HOUR = 3600 * 1000;
const SHORT_SESSION = 12 * HOUR;
const LONG_SESSION = 30 * 24 * HOUR;
const LOCK_WINDOW = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export type CurrentUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  sessionId: string;
};

export class ForbiddenError extends Error {
  constructor() {
    super("Bạn không có quyền thực hiện thao tác này");
    this.name = "ForbiddenError";
  }
}
export class UnauthorizedError extends Error {
  constructor() {
    super("Phiên đăng nhập đã hết, hãy đăng nhập lại");
  }
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(pw: string) {
  return hash(pw);
}

export function verifyPassword(hashStr: string, pw: string) {
  return verify(hashStr, pw).catch(() => false);
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}

function cookieSecure() {
  return process.env.COOKIE_SECURE !== "false";
}

export async function createSession(userId: number, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const maxAge = remember ? LONG_SESSION : SHORT_SESSION;
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + maxAge),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      ip: await getClientIp(),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    // Without "remember" the cookie still survives a browser restart for 12h,
    // which matters for iPhone home-screen apps that get killed often.
    maxAge: Math.floor(maxAge / 1000),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Current user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const s = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  if (Date.now() - s.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.session.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return {
    id: s.user.id,
    username: s.user.username,
    fullName: s.user.fullName,
    role: s.user.role,
    sessionId: s.id,
  };
});

/** For pages and server actions: redirect to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

/** For pages: staff are sent home. */
export async function requireOwnerPage(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "owner") redirect("/");
  return u;
}

/** For server actions: throws ForbiddenError for staff. */
export async function requireOwner(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== "owner") throw new ForbiddenError();
  return u;
}

/** For route handlers: returns a Response on failure instead of redirecting. */
export async function apiUser(ownerOnly = false): Promise<CurrentUser | Response> {
  const u = await getCurrentUser();
  if (!u) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (ownerOnly && u.role !== "owner")
    return Response.json({ error: "Không có quyền" }, { status: 403 });
  return u;
}

export async function isLockedOut(username: string, ip: string) {
  const since = new Date(Date.now() - LOCK_WINDOW);
  const [byUser, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { username, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  return byUser >= MAX_FAILURES || byIp >= MAX_FAILURES;
}

export async function hasAnyUser() {
  return (await db.user.count()) > 0;
}
