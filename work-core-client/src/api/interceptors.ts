import axios, {
  AxiosError,
  AxiosInstance,
  CreateAxiosDefaults,
} from 'axios'
import { PathConfig } from '@/config/path.config'
import { userStore } from '@/store/user.store'

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

// Щоб кілька одночасних 401 (getUser + сповіщення + чат) не робили
// кілька редіректів. Скидається природно при повному перезавантаженні.
let redirecting = false

const isBrowser = () => typeof window !== 'undefined'

// На auth-сторінках не редіректимо — інакше зациклимось
const isOnAuthPage = () =>
  isBrowser() && window.location.pathname.startsWith(PathConfig.AUTH)

function redirectToLogin() {
  if (!isBrowser() || redirecting || isOnAuthPage()) return
  redirecting = true

  // Чистимо стан користувача, щоб не лишалась протухла роль/права
  try {
    userStore.getState().logout()
  } catch {
    /* store може бути ще не готовий — не критично */
  }

  // Запам'ятовуємо, куди хотіли, щоб повернутись після входу
  const from = window.location.pathname + window.location.search
  const target = `${PathConfig.LOGIN}?redirect=${encodeURIComponent(from)}`
  // hard-redirect: перехоплювач працює поза контекстом Next-роутера
  window.location.assign(target)
}

function attachAuthInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // 401 = сесія протухла/відсутня → на логін.
      // 403 (немає прав) НЕ чіпаємо: користувач залогінений.
      if (error.response?.status === 401) {
        redirectToLogin()
      }
      return Promise.reject(error)
    }
  )
}

attachAuthInterceptor(axiosClassic)
attachAuthInterceptor(axiosFormData)
