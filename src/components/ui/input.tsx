import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full min-h-11 rounded-[var(--radius-field)] border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted/80 focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20 disabled:bg-paper";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(field, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(field, "py-2.5 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(field, "pr-8", className)} {...props} />;
  },
);


export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("size-5 shrink-0 rounded accent-jade", className)}
      {...props}
    />
  );
}
