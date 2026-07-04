import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cortège — панель владельца",
    short_name: "Cortège",
    description: "Управление пакетами, вопросами и партнёрами заведения",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
