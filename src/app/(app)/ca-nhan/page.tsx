import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Tài khoản của tôi" };

export default async function MePage() {
  const me = await requireUser();
  return (
    <div className="max-w-xl">
      <PageHeader title="Tài khoản của tôi" />
      <Panel className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{me.fullName}</p>
            <p className="text-sm text-ink-soft">{me.username}</p>
          </div>
          <Tag tone={me.role === "owner" ? "jade" : "neutral"}>{me.role === "owner" ? "Chủ spa" : "Nhân viên"}</Tag>
        </div>
      </Panel>
      <Panel title="Đổi mật khẩu" className="mb-5">
        <ChangePasswordForm />
      </Panel>
      <form action={logout}>
        <Button type="submit" variant="danger" className="w-full sm:w-auto">
          <LogOut className="size-4" /> Đăng xuất
        </Button>
      </form>
    </div>
  );
}
