"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field, INFO } from "./ui/field";
import { Input } from "./ui/input";
import { Combobox } from "./ui/combobox";
import { createProductSale, getActiveProducts, type ProductOption } from "@/actions/product-sales";
import { addDays, todayStr } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";

type Customer = { id: number; name: string; phone: string | null };

export function ProductSaleButton({ customer, label = "Bán mỹ phẩm" }: { customer: Customer; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
      {open && <ProductSaleDialog customer={customer} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Quick cosmetic sale. Mount it to open; `initialProductId` preselects a product (e.g. "Mua thêm"). */
export function ProductSaleDialog({
  customer,
  initialProductId,
  onClose,
}: {
  customer: Customer;
  initialProductId?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [product, setProduct] = useState<ProductOption | null>(null);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [saleDate, setSaleDate] = useState(todayStr());
  const [runOut, setRunOut] = useState("");
  const [runOutTouched, setRunOutTouched] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    getActiveProducts()
      .then((list) => {
        setProducts(list);
        const p = list.find((x) => x.id === initialProductId);
        if (p) choose(p);
      })
      .catch(() => toast.error("Không tải được danh sách mỹ phẩm"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep auto-computed fields in sync until the user edits them.
  useEffect(() => {
    if (!product) return;
    if (!priceTouched) setPrice(String(product.price * qty));
    if (!runOutTouched && saleDate) setRunOut(addDays(saleDate, product.usageDays * Math.max(1, qty)));
  }, [product, qty, saleDate, priceTouched, runOutTouched]);

  function choose(p: ProductOption) {
    setProduct(p);
    setPriceTouched(false);
    setRunOutTouched(false);
  }

  const items = useMemo(
    () => products?.map((p) => ({ value: p.id, label: p.name, sub: fmtMoney(p.price) })) ?? [],
    [products],
  );

  function save() {
    if (!product) return void toast.error("Chọn mỹ phẩm");
    start(async () => {
      const r = await createProductSale({
        customerId: customer.id,
        productId: product.id,
        quantity: qty,
        price: parseInt(price.replace(/\D/g, "") || "0", 10),
        saleDate,
        runOutDate: runOut,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Đã bán ${qty} ${r.data!.productName}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Bán mỹ phẩm · ${customer.name}`}>
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
        }}
      >
        <Field label="Mỹ phẩm" required>
          {product ? (
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-field)] border border-line-strong pl-3">
              <span className="font-semibold">{product.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setProduct(null)}>
                Đổi
              </Button>
            </div>
          ) : (
            <Combobox
              items={items}
              autoFocus
              clearOnSelect={false}
              placeholder={products ? "Tìm mỹ phẩm" : "Đang tải…"}
              onSelect={(i) => {
                const p = products?.find((x) => x.id === i.value);
                if (p) choose(p);
              }}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Số lượng" htmlFor="ps-qty">
            <Input
              id="ps-qty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(999, parseInt(e.target.value.replace(/\D/g, "") || "1", 10))))}
            />
          </Field>
          <Field label="Thành tiền" htmlFor="ps-price">
            <Input
              id="ps-price"
              inputMode="numeric"
              value={price ? new Intl.NumberFormat("vi-VN").format(parseInt(price, 10)) : ""}
              onChange={(e) => {
                setPrice(e.target.value.replace(/\D/g, ""));
                setPriceTouched(true);
              }}
            />
          </Field>
          <Field label="Ngày mua" htmlFor="ps-date">
            <Input id="ps-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </Field>
          <Field label="Dự kiến hết" htmlFor="ps-runout" info={INFO.runOut}>
            <Input
              id="ps-runout"
              type="date"
              value={runOut}
              onChange={(e) => {
                setRunOut(e.target.value);
                setRunOutTouched(true);
              }}
            />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-5 -mb-4 mt-1 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3">
          <Button variant="quiet" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={pending || !product}>
            {pending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
