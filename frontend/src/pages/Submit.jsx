import { useState } from 'react';

export default function Submit() {
  // --- YOUR BRAIN (Logic) ---
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Success! Ticket ID: ${data.trackingId}`);
        setEmail('');
        setMessage('');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error("Connection failed:", err);
      alert("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  // --- HIS FACE (UI) with YOUR BRAIN injected ---
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Submit Request</h1>
      <p className="text-slate-600 mb-8">
        Fill in the form below to submit a support request.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            value={email} // YOUR LOGIC
            onChange={(e) => setEmail(e.target.value)} // YOUR LOGIC
            placeholder="Enter your email..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={6}
            value={message} // YOUR LOGIC
            onChange={(e) => setMessage(e.target.value)} // YOUR LOGIC
            placeholder="Describe your issue or request..."
            className="w-full border rounded-lg px-3 py-2 resize-y"
          />
          <p className="text-xs text-slate-500 mt-2">
            Please include as much detail as possible.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit" // FIXED: Changed from "button" to "submit"
            disabled={loading}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 disabled:bg-slate-400"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}