import { requireOwnerPage } from "@/lib/auth";
import { SubTabs } from "./_components/sub-tabs";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return (
    <>
      <SubTabs
        tabs={[
          { href: "/danh-muc/dich-vu", label: "Dịch vụ" },
          { href: "/danh-muc/my-pham", label: "Mỹ phẩm" },
          { href: "/danh-muc/goi", label: "Gói liệu trình" },
        ]}
      />
      {children}
    </>
  );
}
