import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Document Chat",
  description: "Transform your documents into intelligent, searchable knowledge. NO LIMITS ON DOCUMENT SIZE OR PAGE NUMBERS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-nexa-light">
        {children}
      </body>
    </html>
  );
}
