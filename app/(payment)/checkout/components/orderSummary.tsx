import { useSteps } from "@/app/hooks/useSteps";

// components/OrderSummary.js
export default function OrderSummary() {
  const { step, setStep } = useSteps()
  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Order summary</h2>

      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-gray-900">QuickBooks Enterprise Diamond Edition</h3>
            <p className="text-sm text-gray-600">Monthly</p>
            <div className="text-sm text-blue-600 space-x-1">
              <span>Edition: Standard</span>
              <span>|</span>
              <span>Download</span>
              <span>|</span>
              <span>Users: 1</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900">$447/mo</p>
          </div>
        </div>


        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total due today</span>
            <span className="text-lg font-bold text-gray-900">$447</span>
          </div>
        </div>

        {
          step === 3 && (<button
            className="mt-8 w-full cursor-pointer bg-[#2ca01c] hover:bg-[#2ca01c] text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            Pay Now
          </button>)
        }
        {/*           
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-gray-700">
              Some items in your package have recurring charges. 
              <button className="text-blue-600 hover:text-blue-800 ml-1">
                View estimated fees
              </button>
            </p>
          </div> */}
      </div>
    </div>
  );
}
