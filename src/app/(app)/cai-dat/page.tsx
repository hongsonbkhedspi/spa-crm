import { requireOwnerPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  await requireOwnerPage();
  const settings = await getSettings();
  return (
    <div className="max-w-xl">
      <PageHeader title="Cài đặt" />
      <SettingsForm initial={settings} />
    </div>
  );
}
