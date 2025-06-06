import Stepper from "@/components/stepper";

// app/auth/layout.tsx
export default function PaymentLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
          <Stepper/>
          {children}
        </>

    );
  }
  