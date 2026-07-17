import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AuthGateProvider } from "@/components/home/AuthGateProvider";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Bhavano — Buy, Rent, Coworking, PG & Furniture",
  description:
    "India's home for Buy, Rent, Coworking, PG and Furniture listings — browse without login, verified listings across India.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lora.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <AuthGateProvider>{children}</AuthGateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
