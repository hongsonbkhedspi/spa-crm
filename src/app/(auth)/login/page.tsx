import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const { spaName } = await getSettings();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">{spaName}</h1>
      <p className="mb-8 mt-1 text-ink-soft">Đăng nhập để tiếp tục</p>
      <LoginForm next={next ?? ""} />
    </>
  );
}
