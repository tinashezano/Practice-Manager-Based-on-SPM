import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const appFont = Plus_Jakarta_Sans({ variable: "--font-app", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Outset PM", template: "%s · Outset PM" },
  description: "Practice management for Outset — leads to onboarding to delivery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body className={`${appFont.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
