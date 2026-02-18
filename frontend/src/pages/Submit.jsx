import { useState } from 'react'; // Added hook

export default function Submit() {
  // 1. Setup State to capture inputs
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 2. The function that talks to the Backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }), // Matches backend "Trig Twins"
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Submit Request</h1>
      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)} // Capture input
            placeholder="Enter your email..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Message *</label>
          <textarea
            required
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)} // Capture input
            placeholder="Describe your issue..."
            className="w-full border rounded-lg px-3 py-2 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 disabled:bg-slate-400"
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}