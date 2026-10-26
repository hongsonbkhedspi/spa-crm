/**
 * Dữ liệu mẫu (bật/tắt):
 *   npm run db:seed     → thêm dịch vụ, mỹ phẩm, gói, ~8 khách mẫu và vài giao dịch
 *   npm run db:unseed   → xoá khách mẫu (ghi chú "[mẫu]") cùng giao dịch của họ, và danh mục mẫu chưa dùng
 * Chạy lại nhiều lần không bị nhân đôi. Không tạo tài khoản đăng nhập.
 */
import { PrismaClient } from "@prisma/client";
import { addDays, strToDate, toInstant, todayStr } from "../src/lib/dates";

const db = new PrismaClient();
const TAG = "[mẫu]";

const SERVICES = [
  { name: "Chăm sóc da", price: 350000, recallDays: 14 },
  { name: "Trị mụn", price: 450000, recallDays: 7 },
  { name: "Massage mặt", price: 250000, recallDays: 14 },
  { name: "Gội đầu dưỡng sinh", price: 150000, recallDays: 7 },
];
const PRODUCTS = [
  { name: "Kem dưỡng ẩm", price: 420000, usageDays: 30 },
  { name: "Sữa rửa mặt", price: 280000, usageDays: 45 },
  { name: "Serum phục hồi", price: 650000, usageDays: 30 },
];
const PACKAGES = [
  {
    name: "Trị mụn 10 buổi",
    price: 3800000,
    validityDays: 180,
    intervalDays: 7,
    items: [
      { service: "Trị mụn", sessions: 10 },
      { service: "Massage mặt", sessions: 2 },
    ],
  },
  {
    name: "Chăm sóc da 5 buổi",
    price: 1500000,
    validityDays: 180,
    intervalDays: 14,
    items: [{ service: "Chăm sóc da", sessions: 5 }],
  },
];
const CUSTOMERS = [
  { name: "Nguyễn Thị Hương", phone: "0901234567" },
  { name: "Trần Ngọc Lan", phone: "0912345678" },
  { name: "Lê Thu Trang", phone: "0987654321" },
  { name: "Phạm Minh Thư", phone: "0938111222" },
  { name: "Võ Thị Mai", phone: "0977333444" },
  { name: "Đặng Bảo Ngọc", phone: "0909555666" },
  { name: "Huỳnh Kim Oanh", phone: "0966777888" },
  { name: "Bùi Phương Anh", phone: "0944999000" },
];

async function seed() {
  const today = todayStr();

  // Settings: only fill in what's missing.
  for (const [key, value] of [
    ["spa_name", "Spa"],
    ["product_remind_days", "5"],
    ["package_expiry_days", "14"],
  ]) {
    await db.setting.upsert({ where: { key }, create: { key, value }, update: {} });
  }

  const svc: Record<string, { id: number; price: number }> = {};
  for (const s of SERVICES) {
    const row = (await db.service.findFirst({ where: { name: s.name } })) ?? (await db.service.create({ data: s }));
    svc[s.name] = row;
  }
  const prod: Record<string, { id: number; price: number; usageDays: number }> = {};
  for (const p of PRODUCTS) {
    const row = (await db.product.findFirst({ where: { name: p.name } })) ?? (await db.product.create({ data: p }));
    prod[p.name] = row;
  }
  const pkg: Record<string, { id: number; price: number; validityDays: number | null }> = {};
  for (const p of PACKAGES) {
    const existing = await db.package.findFirst({ where: { name: p.name } });
    pkg[p.name] =
      existing ??
      (await db.package.create({
        data: {
          name: p.name,
          price: p.price,
          validityDays: p.validityDays,
          intervalDays: p.intervalDays,
          items: { create: p.items.map((i) => ({ serviceId: svc[i.service].id, sessions: i.sessions })) },
        },
      }));
  }

  const cust: Record<string, { id: number }> = {};
  for (const c of CUSTOMERS) {
    cust[c.phone] = await db.customer.upsert({
      where: { phone: c.phone },
      create: { ...c, note: TAG },
      update: {},
    });
  }

  // Transactions only once: skip if the first sample customer already has history.
  const already = await db.visit.count({ where: { customerId: cust[CUSTOMERS[0].phone].id } });
  if (already > 0) {
    console.log("Dữ liệu mẫu đã có, bỏ qua phần giao dịch.");
    return;
  }

  const huong = cust["0901234567"].id;
  const lan = cust["0912345678"].id;
  const trang = cust["0987654321"].id;
  const thu = cust["0938111222"].id;
  const mai = cust["0977333444"].id;

  // Hương: bought "Trị mụn 10 buổi" 22 days ago, came 3 times, booked today.
  const pkgAcne = pkg["Trị mụn 10 buổi"];
  const bought = addDays(today, -22);
  const cpAcne = await db.customerPackage.create({
    data: {
      customerId: huong,
      packageId: pkgAcne.id,
      purchaseDate: strToDate(bought),
      paidAmount: pkgAcne.price,
      expiryDate: strToDate(addDays(bought, pkgAcne.validityDays ?? 180)),
      items: {
        create: [
          { serviceId: svc["Trị mụn"].id, totalSessions: 10, usedSessions: 3 },
          { serviceId: svc["Massage mặt"].id, totalSessions: 2, usedSessions: 0 },
        ],
      },
    },
    include: { items: true },
  });
  const acneItem = cpAcne.items.find((i) => i.serviceId === svc["Trị mụn"].id)!;
  for (const [n, offset] of [
    [1, -21],
    [2, -14],
    [3, -7],
  ] as const) {
    await db.visit.create({
      data: {
        customerId: huong,
        visitDate: strToDate(addDays(today, offset)),
        items: { create: { serviceId: svc["Trị mụn"].id, price: 0, customerPackageItemId: acneItem.id, sessionNo: n } },
      },
    });
  }
  await db.appointment.create({
    data: {
      customerId: huong,
      serviceId: svc["Trị mụn"].id,
      customerPackageId: cpAcne.id,
      scheduledAt: toInstant(today, "10:00"),
    },
  });

  // Lan: "Chăm sóc da 5 buổi" nearly done and expiring soon, no appointment → "Gói cần chú ý".
  const pkgSkin = pkg["Chăm sóc da 5 buổi"];
  const boughtSkin = addDays(today, -170);
  const cpSkin = await db.customerPackage.create({
    data: {
      customerId: lan,
      packageId: pkgSkin.id,
      purchaseDate: strToDate(boughtSkin),
      paidAmount: pkgSkin.price,
      expiryDate: strToDate(addDays(boughtSkin, pkgSkin.validityDays ?? 180)),
      items: { create: [{ serviceId: svc["Chăm sóc da"].id, totalSessions: 5, usedSessions: 4 }] },
    },
    include: { items: true },
  });
  await db.visit.create({
    data: {
      customerId: lan,
      visitDate: strToDate(addDays(today, -40)),
      items: { create: { serviceId: svc["Chăm sóc da"].id, price: 0, customerPackageItemId: cpSkin.items[0].id, sessionNo: 4 } },
    },
  });

  // Trang: paid visit + cream bought 27 days ago → runs out in 3 days → "Mỹ phẩm sắp hết".
  const creamDay = addDays(today, -27);
  const trangVisit = await db.visit.create({
    data: {
      customerId: trang,
      visitDate: strToDate(creamDay),
      items: { create: { serviceId: svc["Chăm sóc da"].id, price: svc["Chăm sóc da"].price } },
    },
  });
  await db.productSale.create({
    data: {
      customerId: trang,
      productId: prod["Kem dưỡng ẩm"].id,
      visitId: trangVisit.id,
      quantity: 1,
      price: prod["Kem dưỡng ẩm"].price,
      saleDate: strToDate(creamDay),
      runOutDate: strToDate(addDays(creamDay, prod["Kem dưỡng ẩm"].usageDays)),
    },
  });
  await db.appointment.create({
    data: { customerId: trang, serviceId: svc["Massage mặt"].id, scheduledAt: toInstant(today, "15:30") },
  });

  // Thư: appointment tomorrow; Mai: missed appointment yesterday (still "scheduled" → Lịch quá hạn).
  await db.visit.create({
    data: {
      customerId: thu,
      visitDate: strToDate(addDays(today, -6)),
      items: { create: { serviceId: svc["Gội đầu dưỡng sinh"].id, price: svc["Gội đầu dưỡng sinh"].price } },
    },
  });
  await db.appointment.create({
    data: { customerId: thu, serviceId: svc["Gội đầu dưỡng sinh"].id, scheduledAt: toInstant(addDays(today, 1), "09:30") },
  });
  await db.appointment.create({
    data: { customerId: mai, serviceId: svc["Chăm sóc da"].id, scheduledAt: toInstant(addDays(today, -1), "17:00") },
  });

  // Mai: serum bought 2 months ago, not followed up yet (overdue reminder).
  const serumDay = addDays(today, -60);
  await db.productSale.create({
    data: {
      customerId: mai,
      productId: prod["Serum phục hồi"].id,
      quantity: 1,
      price: prod["Serum phục hồi"].price,
      saleDate: strToDate(serumDay),
      runOutDate: strToDate(addDays(serumDay, prod["Serum phục hồi"].usageDays)),
    },
  });

  console.log("Đã thêm dữ liệu mẫu.");
}

async function unseed() {
  const customers = await db.customer.findMany({ where: { note: { startsWith: TAG } }, select: { id: true } });
  const ids = customers.map((c) => c.id);
  await db.$transaction(async (tx) => {
    await tx.campaignRecipient.deleteMany({ where: { customerId: { in: ids } } });
    await tx.appointment.deleteMany({ where: { customerId: { in: ids } } });
    await tx.productSale.deleteMany({ where: { customerId: { in: ids } } });
    await tx.visit.deleteMany({ where: { customerId: { in: ids } } });
    await tx.customerPackage.deleteMany({ where: { customerId: { in: ids } } });
    await tx.customer.deleteMany({ where: { id: { in: ids } } });
  });

  // Catalog: delete sample items nobody else used; keep (deactivate nothing) if real data references them.
  let kept = 0;
  for (const p of PACKAGES) {
    const row = await db.package.findFirst({ where: { name: p.name } });
    if (!row) continue;
    if ((await db.customerPackage.count({ where: { packageId: row.id } })) === 0) await db.package.delete({ where: { id: row.id } });
    else kept++;
  }
  for (const p of PRODUCTS) {
    const row = await db.product.findFirst({ where: { name: p.name } });
    if (!row) continue;
    if ((await db.productSale.count({ where: { productId: row.id } })) === 0) await db.product.delete({ where: { id: row.id } });
    else kept++;
  }
  for (const s of SERVICES) {
    const row = await db.service.findFirst({ where: { name: s.name } });
    if (!row) continue;
    const used =
      (await db.visitItem.count({ where: { serviceId: row.id } })) +
      (await db.packageItem.count({ where: { serviceId: row.id } })) +
      (await db.customerPackageItem.count({ where: { serviceId: row.id } })) +
      (await db.appointment.count({ where: { serviceId: row.id } }));
    if (used === 0) await db.service.delete({ where: { id: row.id } });
    else kept++;
  }
  console.log(`Đã xoá ${ids.length} khách mẫu.${kept ? ` Giữ lại ${kept} mục danh mục vì đã có dữ liệu thật dùng tới.` : ""}`);
}

(process.argv.includes("--remove") ? unseed() : seed())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
