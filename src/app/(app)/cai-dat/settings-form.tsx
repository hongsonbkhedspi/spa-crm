"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, INFO } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/page";
import { updateSettings } from "@/actions/settings";
import type { Settings } from "@/lib/settings";
import { NumberInput } from "../danh-muc/_components/money-input";

export function SettingsForm({ initial }: { initial: Settings }) {
  const [spaName, setSpaName] = useState(initial.spaName);
  const [productRemindDays, setProduct] = useState<number | null>(initial.productRemindDays);
  const [packageExpiryDays, setPackage] = useState<number | null>(initial.packageExpiryDays);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await updateSettings({
        spaName,
        productRemindDays: productRemindDays ?? 0,
        packageExpiryDays: packageExpiryDays ?? 0,
      });
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? "Đã lưu cài đặt");
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
      }}
    >
      <Panel>
        <div className="flex flex-col gap-4">
          <Field label="Tên spa" htmlFor="set-name" required>
            <Input id="set-name" value={spaName} onChange={(e) => setSpaName(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nhắc mỹ phẩm trước" htmlFor="set-product" info={INFO.remindDays}>
              <NumberInput id="set-product" suffix="ngày" value={productRemindDays} onChange={setProduct} />
            </Field>
            <Field label="Nhắc gói sắp hết hạn" htmlFor="set-package" info={INFO.packageExpiryDays}>
              <NumberInput id="set-package" suffix="ngày" value={packageExpiryDays} onChange={setPackage} />
            </Field>
          </div>
        </div>
      </Panel>
      <Button type="submit" disabled={pending} className="mt-4">
        {pending ? "Đang lưu…" : "Lưu cài đặt"}
      </Button>
    </form>
  );
}
