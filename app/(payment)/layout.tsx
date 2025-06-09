import Stepper from "@/components/stepper";
export const metadata = {
  title: "QuickBooks Payment",
  description: "Payment Gateway for QuickBooks Enterprise Services",
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
  