import { Analytics } from "@vercel/analytics/next"
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const stardom = localFont({
  src: "./fonts/Stardom-Regular.otf",
  variable: "--font-stardom",
  display: "swap",
});

const bevellier = localFont({
  src: "./fonts/Bevellier-Extralight.otf",
  variable: "--font-bevellier",
  display: "swap",
});

const excon = localFont({
  src: "./fonts/Excon-Light.otf",
  variable: "--font-excon",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClaY. by tharun",
  description:
    "Private shared photo rooms for trips, events, and aesthetic photobooks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${stardom.variable} ${bevellier.variable} ${excon.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
