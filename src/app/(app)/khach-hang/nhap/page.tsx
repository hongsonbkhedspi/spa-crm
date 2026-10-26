import { requireOwnerPage } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { ImportForm } from "./import-form";

export const metadata = { title: "Nhập khách từ file" };

export default async function ImportPage() {
  await requireOwnerPage();
  return (
    <>
      <PageHeader title="Nhập khách từ file" topic="cust" />
      <ImportForm />
    </>
  );
}
