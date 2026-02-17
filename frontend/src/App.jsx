import logo from './assets/cei-logo.png';
import { Routes, Route } from "react-router-dom"
import { Link } from "react-router-dom"

import Submit from "./pages/Submit"
import Track from "./pages/Track"

export default function App() {
  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">

          {/* LEFT SIDE: Logo + Text */}
          <Link to="/" className='flex items-center gap-3'>

            <img
              src={logo}
              alt="CEiVoice Logo"
              className="h-10 w-10 object-contain"
            />

            <h1 className='text-2xl font-bold tracking-tight'>
              CEiVoice
            </h1>
          </Link>

          {/* RIGHT SIDE: buttons */}
          <div className="flex items-center gap-6">
            <Link to="/submit" className="text-base font-medium text-slate-700 hover:text-slate-950 transition-colors">
              Submit
            </Link>

            <Link to="/track" className="text-base font-medium text-slate-700 hover:text-slate-950 transition-colors">
              Track
            </Link>

          </div>
        </div>
      </nav>


      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-20 md:py-28">

        <Routes>

          <Route path="/" element={
            <>
              <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-12 shadow-[0_10px_50px_-35px_rgba(15,23,42,0.35)]">
                <p className="text-sm md:text-base uppercase tracking-[0.18em] text-amber-600 font-semibold mb-4">
                  AI Support Desk
                </p>

                <h2 className='text-4xl md:text-6xl font-semibold tracking-tight text-slate-950 mb-6 max-w-3xl leading-tight'>
                  Welcome to CEiVoice
                </h2>

                <p className='text-lg md:text-xl leading-relaxed text-slate-600 max-w-4xl mb-10'>
                CEiVoice is an AI-powered support ticket system designed to streamline issue reporting and resolution. Submit your request in seconds, track real-time updates, and stay informed throughout the entire support process.
                </p>

                <div className='flex flex-col sm:flex-row gap-4'>
                  <Link to="/submit" className='inline-flex items-center justify-center bg-slate-900 text-white px-7 py-3.5 rounded-xl text-base font-semibold tracking-tight hover:bg-slate-800 transition-colors'>
                    Submit Request
                  </Link>

                  <Link to="/track" className='inline-flex items-center justify-center border border-slate-300 text-slate-800 px-7 py-3.5 rounded-xl text-base font-semibold tracking-tight hover:bg-slate-50 transition-colors'>
                    Track Ticket
                  </Link>

                </div>
              </div>
            </>
          } />

          <Route path="/submit" element={<Submit />} />

          <Route path="/track" element={<Track />} />

        </Routes>

      </main>

    </div>
  )
}

