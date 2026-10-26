import type { Role } from "@prisma/client";
import type { Topic } from "./ui/topic";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Colour family of the page; the nav icon uses it so menu and blocks match. */
  topic: Topic;
  badge?: "packages" | "products";
  ownerOnly?: boolean;
  group?: "main" | "catalog";
};

export const NAV: NavItem[] = [
  { href: "/", label: "Hôm nay", icon: "sun", topic: "appt" },
  { href: "/ghi-nhan", label: "Ghi nhận", icon: "pen", topic: "pkg" },
  { href: "/nhat-ky", label: "Nhật ký", icon: "book", topic: "money" },
  { href: "/lich-hen", label: "Lịch hẹn", icon: "calendar", topic: "appt" },
  { href: "/goi", label: "Gói liệu trình", icon: "beads", topic: "pkg", badge: "packages" },
  { href: "/my-pham-sap-het", label: "Mỹ phẩm sắp hết", icon: "droplet", topic: "prod", badge: "products" },
  { href: "/khach-hang", label: "Khách hàng", icon: "users", topic: "cust" },
  { href: "/khuyen-mai", label: "Khuyến mãi", icon: "send", topic: "money" },
  { href: "/danh-muc/dich-vu", label: "Dịch vụ", icon: "sparkles", topic: "neutral", ownerOnly: true, group: "catalog" },
  { href: "/danh-muc/my-pham", label: "Mỹ phẩm", icon: "flask", topic: "neutral", ownerOnly: true, group: "catalog" },
  { href: "/danh-muc/goi", label: "Gói", icon: "layers", topic: "neutral", ownerOnly: true, group: "catalog" },
  { href: "/tai-khoan", label: "Tài khoản", icon: "shield", topic: "neutral", ownerOnly: true, group: "catalog" },
  { href: "/cai-dat", label: "Cài đặt", icon: "settings", topic: "neutral", ownerOnly: true, group: "catalog" },
];

export const MOBILE_TABS = ["/", "/ghi-nhan", "/lich-hen", "/khach-hang"];

export function navFor(role: Role) {
  return NAV.filter((n) => !n.ownerOnly || role === "owner");
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
