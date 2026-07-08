import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

// Titulares: fuente gruesa y redondeada que ecoa el lettering del logo.
const lilita = Lilita_One({
  variable: "--font-lilita",
  weight: "400",
  subsets: ["latin"],
});
// Cuerpo: legible y amable.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://anakleta.vercel.app"),
  title: "Añakleta · Fuerza y Unión",
  description: "Panel de gestión del clan Añakleta",
  // Imagen de previsualización al compartir el enlace (WhatsApp, Discord, etc.).
  openGraph: {
    title: "Añakleta · Fuerza y Unión",
    description: "Panel de gestión del clan Añakleta",
    url: "https://anakleta.vercel.app",
    siteName: "Añakleta",
    locale: "es_ES",
    type: "website",
    images: [{ url: "/logo.jpg", width: 1024, height: 1024, alt: "Escudo del clan Añakleta" }],
  },
  twitter: {
    card: "summary",
    title: "Añakleta · Fuerza y Unión",
    description: "Panel de gestión del clan Añakleta",
    images: ["/logo.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#b32c22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${lilita.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
