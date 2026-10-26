/**
 * Đặt lại mật khẩu chủ spa khi quên (chạy trên máy spa):
 *   npm run reset-owner-password
 * Mọi phiên đăng nhập của tài khoản đó bị đăng xuất.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const owners = await db.user.findMany({ where: { role: "owner" }, orderBy: { id: "asc" } });
    if (owners.length === 0) {
      console.log("Chưa có tài khoản chủ spa. Mở app trong trình duyệt để tạo ở trang /setup.");
      return;
    }
    console.log("Tài khoản chủ spa:");
    for (const o of owners) console.log(`  - ${o.username} (${o.fullName})${o.active ? "" : " [đang khoá]"}`);

    const fallback = owners.length === 1 ? owners[0].username : "";
    const answer = (await rl.question(`Tên đăng nhập${fallback ? ` [${fallback}]` : ""}: `)).trim().toLowerCase();
    const username = answer || fallback;
    const user = owners.find((o) => o.username === username);
    if (!user) {
      console.error(`Không có chủ spa nào tên "${username}".`);
      process.exitCode = 1;
      return;
    }

    const pw = await rl.question("Mật khẩu mới (tối thiểu 8 ký tự): ");
    if (pw.length < 8) {
      console.error("Mật khẩu quá ngắn.");
      process.exitCode = 1;
      return;
    }
    const again = await rl.question("Nhập lại mật khẩu mới: ");
    if (again !== pw) {
      console.error("Hai lần nhập không khớp.");
      process.exitCode = 1;
      return;
    }

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(pw), active: true } }),
      db.session.deleteMany({ where: { userId: user.id } }),
      db.loginAttempt.deleteMany({ where: { username: user.username } }),
    ]);
    console.log(`Đã đặt lại mật khẩu cho ${user.username}. Hãy đăng nhập lại trên các thiết bị.`);
  } finally {
    rl.close();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
