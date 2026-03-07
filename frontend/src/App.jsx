import logo from "./assets/cei-logo.png";
import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

import Submit from "./pages/Submit";
import Track from "./pages/Track";
import Success from "./pages/Success.jsx";
import Login from "./pages/Login";
import Register from "./pages/Register.jsx";
import Admin from "./pages/Admin.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import AssigneeDashboard from "./pages/AssigneeDashboard.jsx";

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("ceivoice_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem("ceivoice_user");
      return null;
    }
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("ceivoice_user");
    setUser(null);
  };

  return (
    <div className={`min-h-screen ${isAdminRoute ? "bg-slate-50" : "bg-white"}`}>
      {!isAdminRoute ? (
        <nav className="bg-white border-b border-slate-200/80">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link to="/" className="flex items-center gap-3">
              <img
                src={logo}
                alt="CEiVoice Logo"
                className="h-10 w-10 object-contain"
              />
              <h1 className="text-2xl font-bold tracking-tight">CEiVoice</h1>
            </Link>

            <div className="flex items-center gap-6">
              {user ? (
                <>
                  <Link
                    to="/submit"
                    className="text-base font-medium text-slate-700 hover:text-slate-950 transition-colors"
                  >
                    Submit
                  </Link>

                  <Link
                    to="/track"
                    className="text-base font-medium text-slate-700 hover:text-slate-950 transition-colors"
                  >
                    Track
                  </Link>

                  <Link
                    to="/assignee"
                    className="text-base font-medium text-slate-700 hover:text-slate-950 transition-colors"
                  >
                    Assignee Dashboard
                  </Link>

                  <Link
                    to="/admin"
                    className="text-base font-medium text-slate-700 hover:text-slate-950 transition-colors"
                  >
                    Admin
                  </Link>

                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      login as {user.username}
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-32 bg-white border rounded-lg shadow-md">
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </nav>
      ) : null}

      <main className={isAdminRoute ? "" : "max-w-6xl mx-auto px-6 py-20 md:py-28"}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth user={user}>
                <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-[0_10px_50px_-35px_rgba(15,23,42,0.35)]">
                  <p className="text-sm md:text-base uppercase tracking-[0.18em] text-amber-600 font-semibold mb-4">
                    AI Support Desk
                  </p>

                  <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-slate-950 mb-6 max-w-3xl leading-tight">
                    Welcome to CEiVoice
                  </h2>

                  <p className="text-lg md:text-xl leading-relaxed text-slate-600 max-w-4xl mb-10">
                    CEiVoice is an AI-powered support ticket system designed to
                    streamline issue reporting and resolution. Submit your
                    request in seconds, track real-time updates, and stay
                    informed throughout the entire support process.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                      to="/submit"
                      className="inline-flex items-center justify-center bg-slate-900 text-white px-7 py-3.5 rounded-xl text-base font-semibold tracking-tight hover:bg-slate-800 transition-colors"
                    >
                      Submit Request
                    </Link>

                    <Link
                      to="/track"
                      className="inline-flex items-center justify-center border border-slate-300 text-slate-800 px-7 py-3.5 rounded-xl text-base font-semibold tracking-tight hover:bg-slate-50 transition-colors"
                    >
                      Track Ticket
                    </Link>
                  </div>
                </div>
              </RequireAuth>
            }
          />

          <Route
            path="/submit"
            element={
              <RequireAuth user={user}>
                <Submit />
              </RequireAuth>
            }
          />

          <Route path="/track"
            element={
              <RequireAuth user={user}>
                <Track />
              </RequireAuth>
            }
          />

          <Route path="/track/:trackingId"
            element={
              <RequireAuth user={user}>
                <Track />
              </RequireAuth>
            }
          />

          <Route
            path="/success"
            element={
              <RequireAuth user={user}>
                <Success />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAuth user={user}>
                <Admin />
              </RequireAuth>
            }
          />

          <Route
            path="/assignee"
            element={
              <RequireAuth user={user}>
                <AssigneeDashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" replace /> : <Register />}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
