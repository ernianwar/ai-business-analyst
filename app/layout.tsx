import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SALAM LIT — AI Business Office",
  description: "Living Virtual AI Business Office — Your AI workforce, visibly working for your business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.className} suppressHydrationWarning>
      <body className="bg-[var(--office-bg)] text-[var(--office-text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
