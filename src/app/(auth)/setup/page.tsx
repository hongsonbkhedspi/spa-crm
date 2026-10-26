import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Tạo tài khoản chủ spa" };

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Tạo tài khoản chủ spa</h1>
      <p className="mb-8 mt-1 text-ink-soft">Chỉ làm một lần cho lần chạy đầu tiên</p>
      <SetupForm />
    </>
  );
}
