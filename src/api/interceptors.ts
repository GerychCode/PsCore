import axios, { CreateAxiosDefaults } from 'axios'

const options: CreateAxiosDefaults = {
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
}
const formDataOptions: CreateAxiosDefaults = {
  baseURL: process.env.NEXT_PUBLIC_SERVER_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  withCredentials: true,
}
export const axiosClassic = axios.create(options)
export const axiosFormData = axios.create(formDataOptions)
