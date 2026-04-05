import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Nexa — UK Construction Tender Intelligence",
  description:
    "Every UK construction tender in one feed. Filtered by trade, region, and value. A Staqtech product.",
  openGraph: {
    title: "Nexa — UK Construction Tender Intelligence",
    description: "Stop checking three portals. Nexa pulls from Contracts Finder, Find a Tender, and PCS — filtered for your trade.",
    siteName: "Nexa",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0A0A0A] text-[#F5F5F5]`}>
        {children}
      </body>
    </html>
  );
}
