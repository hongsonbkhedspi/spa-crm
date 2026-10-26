import { requireUser } from "@/lib/auth";
import { Send } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page";
import { CampaignForm } from "./campaign-form";

export const metadata = { title: "Tạo chiến dịch" };

export default async function NewCampaignPage() {
  await requireUser();
  const [settings, services, sample, total] = await Promise.all([
    getSettings(),
    db.service.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.customer.findFirst({ orderBy: { createdAt: "desc" }, select: { name: true } }),
    db.customer.count(),
  ]);
  return (
    <>
      <PageHeader title="Tạo chiến dịch" topic="money" icon={Send} />
      <CampaignForm
        spaName={settings.spaName}
        sampleName={sample?.name ?? "Lan"}
        services={services.map((s) => ({ value: s.id, label: s.name }))}
        totalCustomers={total}
      />
    </>
  );
}
