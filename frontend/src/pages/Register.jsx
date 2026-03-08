import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // basic validation
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // NOTE: backend must implement this route
      const res = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }

      // if backend returns user info/token later, you can store it here
      // for now just go to login page
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      console.error(err);
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Create an account</h1>
      <p className="text-slate-600 mb-8">
        Register with email & password.
      </p>

      <form onSubmit={handleRegister} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium mb-2">
            Username <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Confirm password <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 disabled:bg-slate-400"
          >
            {loading ? "Creating..." : "Create account"}
          </button>

          <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
            Already have an account? Login
          </Link>
        </div>
      </form>
    </div>
  );
}
