import { requireOwnerPage } from "@/lib/auth";
import { SubTabs } from "../danh-muc/_components/sub-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return (
    <>
      <SubTabs
        tabs={[
          { href: "/cai-dat", label: "Cài đặt chung", exact: true },
          { href: "/cai-dat/sao-luu", label: "Sao lưu" },
        ]}
      />
      {children}
    </>
  );
}
