"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireOwner, requireUser, verifyPassword } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";

function checkPassword(pw: string) {
  if (pw.length < 8) throw new UserError("Mật khẩu tối thiểu 8 ký tự");
}

export async function createStaff(input: { username: string; fullName: string; password: string }): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    const username = input.username.trim().toLowerCase();
    const fullName = input.fullName.normalize("NFC").trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(username))
      throw new UserError("Tên đăng nhập 3–32 ký tự, chữ thường không dấu, số, dấu . _ -");
    if (!fullName) throw new UserError("Nhập họ tên");
    checkPassword(input.password);
    if (await db.user.findUnique({ where: { username } })) throw new UserError("Tên đăng nhập đã tồn tại");
    await db.user.create({
      data: { username, fullName, role: "staff", passwordHash: await hashPassword(input.password) },
    });
    revalidatePath("/tai-khoan");
    return { ok: true, message: `Đã thêm nhân viên ${fullName}` };
  });
}

export async function resetPassword(userId: number, password: string): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    checkPassword(password);
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
      db.session.deleteMany({ where: { userId } }),
    ]);
    revalidatePath("/tai-khoan");
    return { ok: true, message: "Đã đặt lại mật khẩu và đăng xuất mọi thiết bị của tài khoản này" };
  });
}

export async function setUserActive(userId: number, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const me = await requireOwner();
    if (!active) {
      if (userId === me.id) throw new UserError("Không thể tự khoá tài khoản của mình");
      const target = await db.user.findUnique({ where: { id: userId } });
      if (target?.role === "owner") {
        const owners = await db.user.count({ where: { role: "owner", active: true } });
        if (owners <= 1) throw new UserError("Không thể khoá chủ spa cuối cùng");
      }
    }
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { active } }),
      ...(active ? [] : [db.session.deleteMany({ where: { userId } })]),
    ]);
    revalidatePath("/tai-khoan");
    return { ok: true, message: active ? "Đã mở khoá" : "Đã khoá tài khoản" };
  });
}

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    await db.session.deleteMany({ where: { id: sessionId } });
    revalidatePath("/tai-khoan");
    return { ok: true, message: "Đã đăng xuất thiết bị" };
  });
}

export async function revokeAllSessions(userId: number): Promise<ActionResult> {
  return run(async () => {
    const me = await requireOwner();
    // Keep the owner's current session when they log out their own other devices.
    await db.session.deleteMany({
      where: { userId, ...(userId === me.id ? { id: { not: me.sessionId } } : {}) },
    });
    revalidatePath("/tai-khoan");
    return { ok: true, message: "Đã đăng xuất tất cả thiết bị" };
  });
}

export async function changeOwnPassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  return run(async () => {
    const me = await requireUser();
    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(user.passwordHash, input.current))) throw new UserError("Mật khẩu hiện tại không đúng");
    checkPassword(input.next);
    if (input.next !== input.confirm) throw new UserError("Mật khẩu nhập lại không khớp");
    await db.$transaction([
      db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next) } }),
      db.session.deleteMany({ where: { userId: me.id, id: { not: me.sessionId } } }),
    ]);
    return { ok: true, message: "Đã đổi mật khẩu" };
  });
}
