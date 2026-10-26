import { db } from "@/lib/db";
import { requireOwnerPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { PackageEditor } from "../package-editor";

export const metadata = { title: "Thêm gói" };

export default async function NewPackagePage() {
  await requireOwnerPage();
  const services = await db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true } });
  return (
    <>
      <PageHeader title="Thêm gói liệu trình" />
      <PackageEditor services={services} initial={{ name: "", price: null, validityDays: null, intervalDays: null, items: [] }} />
    </>
  );
}
