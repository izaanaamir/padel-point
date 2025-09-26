import axios, { AxiosInstance } from 'axios'

const BASE = 'http://localhost:8000'

class Api {
  private instance: AxiosInstance
  private token: string | null = null

  constructor() {
    this.instance = axios.create({ baseURL: BASE })
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete this.instance.defaults.headers.common['Authorization']
    }
  }

  raw() {
    return this.instance
  }

  async get(path: string, params?: any) {
    return this.instance.get(path, { params })
  }

  async post(path: string, data?: any, opts?: any) {
    return this.instance.post(path, data, opts)
  }

  async delete(path: string, data?: any, opts?: any) {
    return this.instance.delete(path, { data, ...opts })
  }

  async patch(path: string, data?: any, opts?: any) {
    return this.instance.patch(path, data, opts)
  }
}

const api = new Api()
export default api
