import logo from './assets/cei-logo.png';
import { Routes, Route } from "react-router-dom"
import { Link } from "react-router-dom"

import Submit from "./pages/Submit"
import Track from "./pages/Track"

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Navbar */}
      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">

          {/* LEFT SIDE: Logo + Text */}
          <Link to="/" className='flex items-center gap-3'>

            <img
              src={logo}
              alt="CEiVoice Logo"
              className="h-10 w-10 object-contain"
            />

            <h1 className='text-xl font-bold'>
              CEiVoice
            </h1>
          </Link>

          {/* RIGHT SIDE: buttons */}
          <div className="space-x-4">
            <Link to="/submit" className="text-sm hover:underline">
              Submit
            </Link>

            <Link to="/track" className="text-sm hover:underline">
              Track
            </Link>

          </div>
        </div>
      </nav>


      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-20">

        <Routes>

          <Route path="/" element={
            <>
              <h2 className='text-4xl font-bold mb-4'>
                Welcome to CEiVoice
              </h2>

              <p className='text-slate-600 mb-8'>
                Submit your problem and let the support team help you.
              </p>

              <div className='space-x-4'>
                <Link to="/submit" className='bg-slate-900 text-white px-6 py-3 rounded-lg'>
                  Submit Request
                </Link>

                <Link to="/track" className='bg-slate-200 px-6 py-3 rounded-lg'>
                  Track Ticket
                </Link>

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

