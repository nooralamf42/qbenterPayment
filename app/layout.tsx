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
  openGraph: {
    images: [
      {
        url: "https://www.quickbooks-solutions.com/quickbookslogo.png",
        width: 1200,
        height: 630,
        alt: "QuickBooks Enterprise"
      },
      {
        url: "https://www.quickbooks-solutions.com/quickbookslogo.png",
        width: 640,
        height: 335,
        alt: "QuickBooks Enterprise"
      },
      {
        url: "https://www.quickbooks-solutions.com/quickbookslogo.png",
        width: 440,
        height: 220,
        alt: "QuickBooks Enterprise"
      },
      {
        url: "https://www.quickbooks-solutions.com/quickbookslogo.png",
        width: 220,
        height: 110,
        alt: "QuickBooks Enterprise"
      }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-site-verification" content="Sxj4LQsd--REhPVduYHsX03BkCf-Q07puHirfBwhMa0" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Toaster />
        <Providers>
          <Suspense fallback={<Loader/>}>
          <main className="pb-44 md:pb-24">
          {children}
          </main>
          </Suspense>
          {/* Outside the Suspense boundary on purpose. Pages here call useSearchParams(),
              which makes the server skip the whole suspended subtree and render the fallback
              instead — so a Footer inside it is absent from the SSR HTML but present after
              hydration, which React reports as a hydration mismatch. It only needs
              usePathname(), so it renders fine on the server out here. */}
          <Footer/>
        </Providers>
      </body>
    </html>
  );
}
