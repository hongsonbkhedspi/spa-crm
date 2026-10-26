"use client";
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { fold } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ComboItem = {
  value: number;
  label: string;
  sub?: string;
  /** Extra text matched by search (e.g. phone). */
  keywords?: string;
};

export type ComboboxHandle = { focus: () => void; clear: () => void };

type Props = {
  /** Static items, filtered locally (accent-insensitive). */
  items?: ComboItem[];
  /** Or load remotely for each query. */
  load?: (q: string) => Promise<ComboItem[]>;
  onSelect: (item: ComboItem) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Clear the text after selecting (multi-select pattern). */
  clearOnSelect?: boolean;
  /** Rendered under the results, e.g. "+ Khách mới". Receives the current query. */
  footer?: (q: string, close: () => void) => React.ReactNode;
  exclude?: number[];
  id?: string;
  className?: string;
};

/** Searchable combobox. ↑/↓ to move, Enter to pick, Esc to close. */
export const Combobox = forwardRef<ComboboxHandle, Props>(function Combobox(
  { items, load, onSelect, placeholder, autoFocus, clearOnSelect = true, footer, exclude, id, className },
  ref,
) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<ComboItem[]>([]);
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => setQ(""),
  }));

  useEffect(() => {
    if (!load || !open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await load(q);
        if (!cancelled) setRemote(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, load, open]);

  const results = useMemo(() => {
    const ex = new Set(exclude ?? []);
    if (load) return remote.filter((i) => !ex.has(i.value));
    const f = fold(q.trim());
    return (items ?? [])
      .filter((i) => !ex.has(i.value))
      .filter((i) => !f || fold(`${i.label} ${i.keywords ?? ""}`).includes(f))
      .slice(0, 50);
  }, [items, remote, load, q, exclude]);

  useEffect(() => setActive(0), [q]);

  function pick(item: ComboItem) {
    onSelect(item);
    setQ(clearOnSelect ? "" : item.label);
    setOpen(clearOnSelect);
    if (clearOnSelect) inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      if (open && results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const close = () => setOpen(false);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(close, 150)}
          onKeyDown={onKeyDown}
          className="w-full min-h-11 rounded-[var(--radius-field)] border border-line-strong bg-surface pl-9 pr-3 text-base placeholder:text-muted/80 focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20"
        />
      </div>
      {open && (results.length > 0 || footer || (load && q)) && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-[var(--radius-field)] border border-line bg-surface shadow-xl">
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {results.map((item, i) => (
              <li
                key={item.value}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-1.5",
                  i === active && "bg-jade-wash",
                )}
              >
                <span className="truncate font-medium">{item.label}</span>
                {item.sub && <span className="num shrink-0 text-xs text-muted">{item.sub}</span>}
              </li>
            ))}
            {results.length === 0 && !loading && q && (
              <li className="px-3 py-2.5 text-sm text-muted">Không tìm thấy “{q}”</li>
            )}
          </ul>
          {footer && (
            <div className="border-t border-line" onMouseDown={(e) => e.preventDefault()}>
              {footer(q, close)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
