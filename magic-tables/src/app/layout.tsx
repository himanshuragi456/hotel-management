import type { Metadata } from "next";
import { Playfair_Display, Karla } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/navbar";

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const karla = Karla({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Magic Tables — Find a table, order ahead",
  description:
    "Browse restaurants and cafes near you, check live table availability, and place your order before you arrive.",
  keywords: ["restaurant", "table booking", "order food", "cafe", "food delivery"],
  openGraph: {
    title: "Magic Tables",
    description: "Find a table, order ahead.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${karla.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col bg-stone-50 text-stone-900 font-body">
        <Providers>
          <Navbar />
          <div className="flex-1">{children}</div>
          <footer suppressHydrationWarning className="border-t border-stone-100 bg-white py-6 text-center text-sm text-stone-400">
            © {new Date().getFullYear()} Magic Tables · Powered by your favourite local spots
          </footer>
        </Providers>
      </body>
    </html>
  );
}
