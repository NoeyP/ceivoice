import { Link, useLocation, Navigate } from "react-router-dom";

export default function Success() {
  const { state } = useLocation();
  if (!state?.trackingId) {
    return <Navigate to="/submit" replace /> /* if the user manually open /success page without pressing the submit button it will redirect to /submit page */
  }

  const trackingId = state.trackingId;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border rounded-xl p-6">
        <h1 className="text-3xl font-bold mb-2">Request submitted!</h1>
        <p className="text-slate-600 mb-6">
          We have received your support request.
        </p>

        {trackingId && (
          <div className="bg-slate-50 border rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-600">Your Ticket ID</p>
            <p className="text-xl font-semibold">{trackingId}</p>
          </div>
        )}

        <p className="text-sm text-slate-500 mb-6">
          A confirmation email should arrive within 60 seconds.
        </p>

        <div className="flex gap-3">
          <Link
            to="/submit"
            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800"
          >
            Submit another request
          </Link>

          <Link
            to="/"
            className="border px-5 py-2.5 rounded-lg hover:bg-slate-50"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

