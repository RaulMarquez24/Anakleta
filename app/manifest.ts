import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Añakleta · Panel del clan",
    short_name: "Añakleta",
    description: "Panel privado de gestión del clan Añakleta (Clash of Clans).",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1108",
    theme_color: "#b32c22",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
