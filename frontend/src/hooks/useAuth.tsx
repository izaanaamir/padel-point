import React, { useContext, useState, useEffect } from 'react'
import api from '../lib/api'

type AuthContextType = {
  token: string | null
  user: string | null
  role: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('user'))
  const [role, setRole] = useState<string | null>(() => localStorage.getItem('role'))
  useEffect(() => {
    if (token) {
      api.setToken(token)
      localStorage.setItem('token', token)
    } else {
      api.setToken(null)
      localStorage.removeItem('token')
      localStorage.removeItem('role')
    }
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('user', user)
    else localStorage.removeItem('user')
  }, [user])

  useEffect(() => {
    if (role) localStorage.setItem('role', role)
    else localStorage.removeItem('role')
  }, [role])

  const login = async (username: string, password: string) => {
    // OAuth2 token endpoint expects form-urlencoded
    const body = new URLSearchParams()
    body.append('username', username)
    body.append('password', password)
    const resp = await api.raw().post('/auth/token', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
    const token = resp.data.access_token
    setToken(token)
    setUser(username)
    setRole(resp.data.role)
    // api.setToken called via effect
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
