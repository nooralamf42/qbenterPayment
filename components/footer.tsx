'use client'

import { useState } from "react"
import { X } from "lucide-react"

const Footer = () => {
  const [visible, setVisible] = useState(true)

  return (
    <footer
      className={`w-full bg-gray-50 text-gray-700 py-8 px-4 md:px-10 border-t transition-all duration-500 ease-in-out
      ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20 pointer-events-none"} fixed bottom-0`}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-4 relative text-center md:text-left">
        {/* Close Button */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Close Footer"
        >
          <X size={20} />
        </button>

        <h2 className="text-base font-semibold text-gray-800">Legal Disclaimer</h2>
        <p className="text-sm leading-relaxed">
          <span className="font-semibold">Intuit</span>, QuickBooks, QuickBooks ProAdvisor and logo are registered trademarks of Intuit Inc.
          Used here with permission under the QuickBooks ProAdvisor Agreement.
        </p>
        <p className="text-sm leading-relaxed">
          Terms and conditions, features, support, pricing, and service options are subject to change without notice.
        </p>
      </div>
    </footer>
  )
}

export default Footer
