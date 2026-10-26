import "server-only";
import { cache } from "react";
import { db } from "./db";
import { getSettings } from "./settings";
import { dueProductsWhere } from "./products";
import { loadPackageOverview } from "./packages";

/** Badge numbers for the navigation. Cached per request. */
export const getNavCounts = cache(async () => {
  const settings = await getSettings();
  const [products, packages] = await Promise.all([
    db.productSale.count({ where: dueProductsWhere(settings.productRemindDays) }),
    loadPackageOverview({ expiryDays: settings.packageExpiryDays }),
  ]);
  return {
    products,
    packages: packages.filter((p) => p.flags.length > 0).length,
  };
});
