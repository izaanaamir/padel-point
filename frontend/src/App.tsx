import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Navigate } from 'react-router-dom';
import LoginPage from './pages/Login'
import BookingPage from './pages/Booking'
import Dashboard from './pages/Dashboard'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import logo from './assets/image-text.png'

const Nav = () => {
  const { user, logout } = useAuth()

  return (
    <nav className="bg-gradient-to-r from-indigo-100 via-indigo-200 to-indigo-300 shadow-md px-6 py-4 flex justify-between items-center">
      <div className="text-2xl font-bold text-indigo-600"><img src={logo} alt="Padel Point" className="h-10" /></div>

      <div className="flex items-center space-x-4">
        {/* Links for logged-in users */}
        {user && (
          <>
            <Link
              to="/add-booking"
              className="text-gray-700 hover:text-indigo-600 font-medium transition"
            >
              Add Booking
            </Link>
            <Link
              to="/dashboard"
              className="text-gray-700 hover:text-indigo-600 font-medium transition"
            >
              Dashboard
            </Link>

            <span className="text-sm text-gray-500">
              Signed in as <strong className="text-gray-800">{user}</strong>
            </span>

            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600 transition"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Nav />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Routes>
          <Route
            path="/"
            element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
          />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/add-booking"
            element={
              <ProtectedRoute>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
