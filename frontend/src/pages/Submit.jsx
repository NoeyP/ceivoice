export default function Submit() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Submit Request</h1>
      <p className="text-slate-600 mb-8">
        Fill in the form below to submit a support request.
      </p>

      <form className="bg-white border rounded-xl p-6 space-y-6">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            placeholder="Enter your email..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        {/* Message / Request (required) */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={6}
            placeholder="Describe your issue or request..."
            className="w-full border rounded-lg px-3 py-2 resize-y"
          />
          <p className="text-xs text-slate-500 mt-2">
            Please include as much detail as possible.
          </p>
        </div>

        {/* Submit button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800"
          >
            Submit
          </button>

        </div>
      </form>
    </div >
  );
}

