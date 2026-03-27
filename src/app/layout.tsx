import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kasir AI - AI Powered POS System",
  description: "Sistem Point of Sale (POS) berbasis AI untuk toko retail, kafe, dan restoran. Fitur: manajemen produk, transaksi cepat, laporan penjualan, dan asisten AI untuk rekomendasi produk dan analisis penjualan.",
  openGraph: {
    title: "Kasir AI - AI Powered POS System",
    description: "Sistem Point of Sale (POS) berbasis AI untuk toko retail, kafe, dan restoran. Fitur: manajemen produk, transaksi cepat, laporan penjualan, dan asisten AI untuk rekomendasi produk dan analisis penjualan.",
    siteName: "Kasir AI",
    images: [
      {
        url: "/kasir-ai-og.jpg",
        width: 1200,
        height: 630,
        alt: "Kasir AI - AI Powered POS System",
      }
    ],
    locale: "id_ID",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
