"use client";

import { usePathname } from "next/navigation";

const Footer = () => {
  const pathname = usePathname();

  // Matches quickbooks-enterprises.com: the legal bar shows on the home and login pages too.
  // The payment layout reserves pb-40, so the fixed bar never covers the forms.
  if (pathname === "/maintenance" || pathname.startsWith("/product/checkout") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer
      className="w-full bg-secondary text-gray-700 py-4 px-4 md:px-10 border-t fixed bottom-0 z-50"
    >
        <p className="leading-relaxed text-center text-sm">
          <span className="font-semibold text-gray-800 mr-1">Legal Disclaimer:</span>
          <span className="font-semibold">Intuit</span>, QuickBooks, QuickBooks ProAdvisor and logo are registered trademarks of Intuit Inc.
          Used here with permission under the QuickBooks ProAdvisor Agreement. Terms and conditions, features, support, pricing, and service options are subject to change without notice.
        </p>
    </footer>
  )
}

export default Footer
