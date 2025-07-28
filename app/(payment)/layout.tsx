import Stepper from "@/components/stepper";
export const metadata = {
  title: "QuickBooks Payment",
  description: "Payment Gateway for QuickBooks Enterprise Services",
  openGraph: {
    images: [
      {
        path: "https://www.quickbooks-solutions.com/quickbooks_logo.png",
        width: 1200,
        height: 630,
        alt: "QuickBooks Enterprise"
      },
      {
        url: "https://www.quickbooks-solutions.com/quickbooks_logo.png",
        width: 640,
        height: 335,
        alt: "QuickBooks Enterprise"
      },
      {
        url: "https://www.quickbooks-solutions.com/quickbooks_logo.png",
        width: 440,
        height: 220,
        alt: "QuickBooks Enterprise"
      },
      {
        url: "https://www.quickbooks-solutions.com/quickbooks_logo.png",
        width: 220,
        height: 110,
        alt: "QuickBooks Enterprise"
      }
    ]
  }
};

// app/auth/layout.tsx
export default function PaymentLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="pb-40">
          <Stepper/>
          {children}
        </main>

    );
  }
  