"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProductSaleDialog } from "@/components/product-sale-button";
import { markFollowUp, type FollowUpResult } from "@/actions/product-sales";
import { cn } from "@/lib/utils";

const OPTIONS: { value: FollowUpResult; label: string }[] = [
  { value: "repurchased", label: "Mua thêm" },
  { value: "contacted", label: "Chưa mua" },
  { value: "not_interested", label: "Không quan tâm" },
];

export function FollowUpButton({
  saleId,
  customer,
  productId,
}: {
  saleId: number;
  customer: { id: number; name: string; phone: string | null };
  productId: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FollowUpResult | null>(null);
  const [note, setNote] = useState("");
  const [selling, setSelling] = useState(false);
  const [pending, start] = useTransition();

  function mark(res: FollowUpResult) {
    start(async () => {
      const r = await markFollowUp(saleId, res, note);
      if (!r.ok) return void toast.error(r.error);
      if (res !== "repurchased") toast.success("Đã ghi nhận");
      router.refresh();
    });
  }

  function save() {
    if (!result) return;
    setOpen(false);
    // Marking removes this row (and this component), so for "Mua thêm"
    // the sale dialog goes first and the follow-up is recorded when it closes.
    if (result === "repurchased") setSelling(true);
    else mark(result);
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          setResult(null);
          setNote("");
          setOpen(true);
        }}
      >
        Đã hỏi
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Đã hỏi · ${customer.name}`}>
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Kết quả" className="grid grid-cols-3 gap-2">
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={result === o.value}
                onClick={() => setResult(o.value)}
                className={cn(
                  "min-h-11 rounded-[var(--radius-field)] border px-2 text-sm font-medium",
                  result === o.value ? "border-jade bg-jade text-white" : "border-line-strong hover:border-jade",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Field label="Ghi chú" htmlFor={`fu-note-${saleId}`}>
            <Input
              id={`fu-note-${saleId}`}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Đóng
          </Button>
          <Button onClick={save} disabled={!result || pending}>
            {pending ? "Đang lưu…" : result === "repurchased" ? "Lưu và bán" : "Lưu"}
          </Button>
        </div>
      </Dialog>
      {selling && (
        <ProductSaleDialog
          customer={customer}
          initialProductId={productId}
          onClose={() => {
            setSelling(false);
            mark("repurchased");
          }}
        />
      )}
    </>
  );
}
