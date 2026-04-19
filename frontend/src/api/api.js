import axios from 'axios'

const browserHost =
  typeof window !== 'undefined' ? window.location.hostname : 'localhost'

const defaultApiBaseUrl = `http://${browserHost}:8000/api`
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.warn('API request failed:', error.message)
    return Promise.reject(error)
  }
)

export const getHealth = () => api.get('/health')
export const getDatasetInfo = () => api.get('/dataset/info')
export const getClassDistribution = () => api.get('/eda/class-distribution')
export const getAmountStats = () => api.get('/eda/amount-stats')
export const getFeatureCorrelations = () => api.get('/eda/feature-correlations')
export const getModelMetrics = () => api.get('/models/metrics')
export const getBatchAnalytics = () => api.get('/batch/analytics')
export const predictTransaction = (data) => api.post('/predict', data)
export const trainModels = () => api.post('/models/train')

export default api
