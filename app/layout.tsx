import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "../components/providers";
import { Toaster } from "react-hot-toast";
import { Suspense } from "react";
import Footer from "@/components/footer";
import Loader from "@/components/loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuickBooks Enterprise",
  description: "Accounting Software for small businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Toaster />
        <Providers>
          <Suspense fallback={<Loader/>}>
          <main className="pb-24">
          {children}
          </main>
          <Footer/>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
