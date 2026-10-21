import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Catholica",
    short_name: "Catholica",
    description: "A personal companion for the Mass.",
    start_url: "/",
    display: "standalone",
    theme_color: "#FAFAF8",
    background_color: "#FAFAF8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
