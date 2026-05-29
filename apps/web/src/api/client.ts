import axios from 'axios'
import { decodeJwtPayload } from '../store/auth'
import type { paths } from './types'

const API_BASE = import.meta.env.VITE_API_URL || ''

const http = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

let proactiveRefreshPromise: Promise<void> | null = null

function getTokenExpiry(token: string): Date | null {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return null
  return new Date(payload.exp * 1000)
}

http.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token')
  if (!token) return config

  const expiry = getTokenExpiry(token)
  if (expiry && expiry.getTime() - Date.now() < 5 * 60 * 1000) {
    if (!proactiveRefreshPromise) {
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        proactiveRefreshPromise = axios
          .post(`${API_BASE}/auth/refresh`, { refreshToken })
          .then(({ data }) => {
            localStorage.setItem('token', data.accessToken)
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
          })
          .catch(() => {})
          .finally(() => {
            proactiveRefreshPromise = null
          })
      }
    }
    await proactiveRefreshPromise
  }

  const currentToken = localStorage.getItem('token')
  if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  for (const p of failedQueue) {
    if (error) p.reject(error)
    else p.resolve(token as string)
  }
  failedQueue = []
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config
    if (err.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return http(originalRequest)
        })
        .catch((e) => Promise.reject(e))
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      }
      return Promise.reject(err)
    }

    try {
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
        refreshToken,
      })
      const newToken = data.accessToken
      const newRefresh = data.refreshToken
      localStorage.setItem('token', newToken)
      if (newRefresh) localStorage.setItem('refreshToken', newRefresh)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      processQueue(null, newToken)
      return http(originalRequest)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      if (window.location.pathname !== '/login') {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      }
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)

export { http }
export type { paths }

// --- Twin Status Matrix API ---

export interface PatientStatusResult {
  patientId: string
  patientName: string
  overallState: 'stable' | 'watch' | 'alert' | 'emergency'
  dimensions: Record<
    string,
    { value: number | string | null; status: 'normal' | 'warning' | 'critical' | 'no_data'; unit?: string }
  >
  timestamp: string
}

export interface TransitionRecord {
  from: string
  to: string
  triggerMetric: string
  timestamp: string
}

export interface TimeseriesParams {
  metrics?: string
  start?: string
  end?: string
}

export interface StateLabel {
  timestamp: string
  state: string
  duration: number | null
}

export async function fetchStatusMatrix(): Promise<PatientStatusResult[]> {
  const { data } = await http.get('/twin/status-matrix')
  return data as PatientStatusResult[]
}

export async function fetchPatientTransitions(patientId: string): Promise<TransitionRecord[]> {
  const { data } = await http.get(`/twin/state-transitions/${patientId}`)
  return data as TransitionRecord[]
}

export async function fetchPatientTimeseries(
  patientId: string,
  params?: TimeseriesParams,
): Promise<Record<string, unknown>[]> {
  const { data } = await http.get(`/twin/ml-timeseries/${patientId}`, { params })
  return data as Record<string, unknown>[]
}

export async function fetchPatientStateLabels(patientId: string): Promise<StateLabel[]> {
  const { data } = await http.get(`/twin/state-labels/${patientId}`)
  return data as StateLabel[]
}
