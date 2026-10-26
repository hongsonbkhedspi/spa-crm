import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";

export function Field({
  label,
  htmlFor,
  info,
  required,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  info?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink-soft">
          {label}
          {required && <span className="text-lotus"> *</span>}
        </label>
        {info && <InfoTip text={info} />}
      </div>
      {children}
      {error && <p className="text-xs text-lotus">{error}</p>}
    </div>
  );
}

/** Shared ⓘ texts from the spec. */
export const INFO = {
  recallDays: "Số ngày gợi ý cho lần hẹn tiếp theo sau khi làm dịch vụ này.",
  usageDays: "Một sản phẩm dùng hết trong khoảng bao nhiêu ngày. Dùng để nhắc khi khách sắp hết.",
  remindDays: "Hiện nhắc trước ngày dự kiến hết bao nhiêu ngày.",
  validityDays: "Số ngày khách được dùng gói kể từ ngày mua. Để trống nếu không giới hạn.",
  intervalDays: "Số ngày gợi ý giữa 2 buổi liệu trình, dùng để đề xuất ngày hẹn.",
  usePackage: "Buổi này được tính vào gói khách đã mua, không thu tiền.",
  packageExpiryDays: "Gói còn buổi mà hạn dùng còn ít hơn số ngày này sẽ hiện trong mục Gói cần chú ý.",
  runOut: "Tự tính = ngày mua + số ngày dùng × số lượng. Sửa được.",
  expiry: "Tự tính = ngày mua + hạn dùng của gói. Sửa được.",
} as const;
