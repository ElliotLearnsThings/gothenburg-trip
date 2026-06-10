import type { Metadata } from "next";
import { Caprasimo, Short_Stack, Caveat } from "next/font/google";
import "./globals.css";

const display = Caprasimo({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const body = Short_Stack({
  variable: "--font-body",
  weight: "400",
  subsets: ["latin"],
});

const hand = Caveat({
  variable: "--font-hand",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Gothenburg Treasure Hunt",
  description:
    "Two duos, twelve treasures, one day — a museum treasure hunt through Göteborg from our doorstep in Örgryte to the lights of Liseberg.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
