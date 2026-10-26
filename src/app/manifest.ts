import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spa CRM",
    short_name: "Spa CRM",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: "#2e6e60",
    lang: "vi",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
