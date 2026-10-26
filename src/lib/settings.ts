import { db } from "./db";

export type Settings = {
  spaName: string;
  productRemindDays: number;
  packageExpiryDays: number;
};

const DEFAULTS: Settings = {
  spaName: "Spa",
  productRemindDays: 5,
  packageExpiryDays: 14,
};

const KEYS: Record<keyof Settings, string> = {
  spaName: "spa_name",
  productRemindDays: "product_remind_days",
  packageExpiryDays: "package_expiry_days",
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    spaName: map.get(KEYS.spaName) || DEFAULTS.spaName,
    productRemindDays: num(map.get(KEYS.productRemindDays), DEFAULTS.productRemindDays),
    packageExpiryDays: num(map.get(KEYS.packageExpiryDays), DEFAULTS.packageExpiryDays),
  };
}

export async function saveSettings(s: Settings) {
  await db.$transaction(
    (Object.keys(KEYS) as (keyof Settings)[]).map((k) =>
      db.setting.upsert({
        where: { key: KEYS[k] },
        create: { key: KEYS[k], value: String(s[k]) },
        update: { value: String(s[k]) },
      }),
    ),
  );
}

function num(v: string | undefined, d: number) {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : d;
}
