import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function Login({ onLogin }) {

  const navigate = useNavigate();
  const location = useLocation();

  const registered = location.state?.registered;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleLogin = async (e) => {

    e.preventDefault();

    setLoading(true);
    setError("");

    try {

      const response = await fetch(`${API_URL}/api/login`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          username,
          password,
        }),

      });

      const data = await response.json();

      if (response.ok) {

        localStorage.setItem(
          "ceivoice_user",
          JSON.stringify(data.user)
        );

        onLogin?.(data.user);

        // redirect to home page
        navigate("/");

      } else {

        setError(data.error || "Login failed");

      }

    } catch (error) {

      console.error(error);

      setError("Cannot connect to server");

    } finally {

      setLoading(false);

    }

  };


  return (

    <div className="max-w-2xl mx-auto">

      <h1 className="text-3xl font-bold mb-2">
        Login
      </h1>

      <p className="text-slate-600 mb-8">
        Login to your CEiVoice account.
      </p>


      {/* show register success message */}
      {registered && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-6 text-sm">
          Account created successfully. Please login.
        </div>
      )}


      <form
        onSubmit={handleLogin}
        className="bg-white border rounded-xl p-6 space-y-6"
      >

        <div>

          <label className="block text-sm font-medium mb-2">
            Username
          </label>

          <input

            required
            type="text"

            value={username}

            onChange={(e) =>
              setUsername(e.target.value)
            }

            className="w-full border rounded-lg px-3 py-2"

          />

        </div>


        <div>

          <label className="block text-sm font-medium mb-2">
            Password
          </label>

          <input

            required
            type="password"

            value={password}

            onChange={(e) =>
              setPassword(e.target.value)
            }

            className="w-full border rounded-lg px-3 py-2"

          />

        </div>


        {/* error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}


        <div className="flex items-center gap-3">

          <button

            type="submit"

            disabled={loading}

            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 disabled:bg-slate-400"

          >

            {loading ? "Logging in..." : "Login"}

          </button>


          {/* register link */}
          <Link
            to="/register"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Create account
          </Link>


        </div>


      </form>

    </div>

  );

}
