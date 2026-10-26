import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Spa CRM", template: "%s · Spa CRM" },
  applicationName: "Spa CRM",
  appleWebApp: { capable: true, title: "Spa CRM", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f8f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          position="top-center"
          duration={2600}
          toastOptions={{
            className: "!rounded-xl !border-0 !bg-ink !text-white !font-sans !text-sm",
          }}
        />
      </body>
    </html>
  );
}
