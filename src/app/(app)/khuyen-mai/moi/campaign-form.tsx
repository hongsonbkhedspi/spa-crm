"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { countRecipients, createCampaign, type PackageFilter, type RecipientFilter } from "@/actions/campaigns";
import { renderMessage, VARIABLES } from "@/lib/messaging/render";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/page";
import { Combobox, type ComboItem } from "@/components/ui/combobox";

const PACKAGE_OPTIONS: { value: PackageFilter; label: string }[] = [
  { value: "any", label: "Không lọc theo gói" },
  { value: "has", label: "Đang có gói" },
  { value: "none", label: "Không có gói" },
  { value: "nearlyDone", label: "Gói sắp xong (còn ≤ 1 buổi)" },
];

export function CampaignForm({
  spaName,
  sampleName,
  services,
  totalCustomers,
}: {
  spaName: string;
  sampleName: string;
  services: ComboItem[];
  totalCustomers: number;
}) {
  const router = useRouter();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [service, setService] = useState<ComboItem | null>(null);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [pkg, setPkg] = useState<PackageFilter>("any");
  const [count, setCount] = useState<number | null>(totalCustomers);
  const [counting, setCounting] = useState(false);
  const [pending, start] = useTransition();

  const filter: RecipientFilter = {
    serviceId: service?.value ?? null,
    lastVisitBefore: before || null,
    lastVisitAfter: after || null,
    package: pkg,
  };
  const filterKey = JSON.stringify(filter);
  const filtered = !!(service || before || after || pkg !== "any");

  useEffect(() => {
    if (!filtered) {
      setCount(totalCustomers);
      return;
    }
    let cancelled = false;
    setCounting(true);
    const t = setTimeout(async () => {
      const r = await countRecipients(JSON.parse(filterKey));
      if (cancelled) return;
      setCounting(false);
      setCount(r.ok ? (r.data ?? 0) : null);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [filterKey, filtered, totalCustomers]);

  function insertVar(token: string) {
    const el = textRef.current;
    if (!el) return setContent((c) => c + token);
    const s = el.selectionStart ?? content.length;
    const e = el.selectionEnd ?? content.length;
    const next = content.slice(0, s) + token + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    start(async () => {
      const r = await createCampaign({ title, content, filter });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Đã tạo chiến dịch");
      router.push(`/khuyen-mai/${r.data!.id}`);
    });
  }

  const chars = [...content].length;

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submit();
        }
      }}
      className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <Panel topic="money" icon={MessageCircle} title="Tin nhắn">
          <div className="flex flex-col gap-4">
            <Field label="Tiêu đề" htmlFor="title" required info="Chỉ để bạn nhận ra chiến dịch, khách không thấy.">
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Ưu đãi tháng 11" autoFocus required />
            </Field>
            <Field label="Nội dung" htmlFor="content" required>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <Button key={v.token} variant="secondary" size="sm" onClick={() => insertVar(v.token)}>
                    {v.label} <span className="font-normal text-muted">{v.token}</span>
                  </Button>
                ))}
              </div>
              <Textarea
                id="content"
                ref={textRef}
                rows={7}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Chào {ten}, {ten_spa} tặng chị ưu đãi 20% liệu trình chăm sóc da trong tháng này 🌿"
                required
              />
              <p className="num text-right text-xs text-muted">{chars} ký tự</p>
            </Field>
          </div>
        </Panel>

        <Panel topic="cust" title="Người nhận" clip={false}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Đã dùng dịch vụ" className="sm:col-span-2">
              {service ? (
                <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-field)] border border-jade/40 bg-jade-wash/60 pl-3 pr-1">
                  <span className="font-medium">{service.label}</span>
                  <button type="button" onClick={() => setService(null)} aria-label="Bỏ lọc dịch vụ" className="grid size-11 place-items-center rounded-full text-muted hover:text-ink md:size-9">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <Combobox items={services} onSelect={setService} placeholder="Tất cả dịch vụ" clearOnSelect={false} />
              )}
            </Field>
            <Field label="Lần cuối đến sau ngày" htmlFor="after">
              <Input id="after" type="date" value={after} onChange={(e) => setAfter(e.target.value)} />
            </Field>
            <Field label="Lần cuối đến trước ngày" htmlFor="before">
              <Input id="before" type="date" value={before} onChange={(e) => setBefore(e.target.value)} />
            </Field>
            <Field label="Gói liệu trình" htmlFor="pkg" className="sm:col-span-2">
              <Select id="pkg" value={pkg} onChange={(e) => setPkg(e.target.value as PackageFilter)}>
                {PACKAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <Panel title="Xem trước" aside={<span className="text-xs text-muted">Gửi cho {sampleName}</span>}>
          <div className="rounded-2xl rounded-bl-md bg-[#e5efff] px-4 py-3 text-base leading-relaxed whitespace-pre-wrap break-words text-ink">
            {content.trim() ? renderMessage(content, { name: sampleName, spaName }) : <span className="text-muted">Nội dung tin nhắn hiện ở đây</span>}
          </div>
        </Panel>
        <div className="flex items-center justify-between gap-3">
          <p className="num text-sm" aria-live="polite">
            {counting ? "Đang đếm…" : count === null ? "" : <><strong className="text-base">{count}</strong> khách sẽ nhận</>}
          </p>
          <Button type="submit" disabled={pending || !title.trim() || !content.trim() || count === 0}>
            {pending ? "Đang tạo…" : "Tạo danh sách gửi"}
          </Button>
        </div>
      </div>
    </form>
  );
}
