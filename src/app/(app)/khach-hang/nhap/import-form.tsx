"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { importCustomers, type ImportResult } from "@/actions/customer-admin";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/page";

export function ImportForm() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await importCustomers(fd);
      if (!r.ok) return void toast.error(r.error);
      setResult(r.data!);
      toast.success(`Đã thêm ${r.data!.added} khách`);
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Panel>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label="File khách hàng"
            htmlFor="file"
            info="File .csv hoặc .xlsx, dòng đầu là tiêu đề cột: Tên, SĐT, Ghi chú. SĐT trùng với khách đã có sẽ được bỏ qua."
          >
            <label
              htmlFor="file"
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-field)] border border-dashed border-line-strong bg-paper px-4 py-5 text-center text-sm hover:border-jade"
            >
              <FileUp className="size-6 text-jade" />
              <span className="font-medium">{fileName || "Chọn file .csv hoặc .xlsx"}</span>
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              required
              onChange={(e) => {
                setFileName(e.target.files?.[0]?.name ?? "");
                setResult(null);
              }}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !fileName}>
              {pending ? "Đang nhập…" : "Nhập khách"}
            </Button>
            <Link href="/khach-hang" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-ink-soft hover:text-ink">
              Về danh sách khách
            </Link>
          </div>
        </form>
      </Panel>

      {result && (
        <Panel title="Kết quả">
          <p className="num text-base">
            Đã thêm <strong className="text-jade-deep">{result.added}</strong> khách
            {result.skipped.length > 0 && (
              <>
                , bỏ qua <strong className="text-turmeric">{result.skipped.length}</strong> dòng
              </>
            )}
            .
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto rounded-[var(--radius-field)] border border-line">
              {result.skipped.map((s) => (
                <li key={s.row} className="grid grid-cols-[3.5rem_1fr] gap-x-3 px-3 py-2 text-sm sm:grid-cols-[3.5rem_1fr_1fr_1.2fr]">
                  <span className="num text-muted">Dòng {s.row}</span>
                  <span className="truncate">{s.name || "—"}</span>
                  <span className="num col-start-2 truncate text-ink-soft sm:col-start-auto">{s.phone || "—"}</span>
                  <span className="col-start-2 text-turmeric sm:col-start-auto">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
