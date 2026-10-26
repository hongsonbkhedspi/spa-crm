import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwnerPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { PackageEditor } from "../package-editor";

export const metadata = { title: "Sửa gói" };

export default async function EditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [pkg, services] = await Promise.all([
    db.package.findUnique({
      where: { id },
      include: { items: { include: { service: { select: { name: true } } }, orderBy: { id: "asc" } } },
    }),
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true } }),
  ]);
  if (!pkg) notFound();
  return (
    <>
      <PageHeader title={pkg.name} />
      <PackageEditor
        services={services}
        initial={{
          id: pkg.id,
          name: pkg.name,
          price: pkg.price,
          validityDays: pkg.validityDays,
          intervalDays: pkg.intervalDays,
          items: pkg.items.map((i) => ({ serviceId: i.serviceId, serviceName: i.service.name, sessions: i.sessions })),
        }}
      />
    </>
  );
}
