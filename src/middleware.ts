import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PathConfig } from '@/config/path.config'

export default function middleware(request: NextRequest) {
  const { url, headers, cookies } = request
  const isWipPage = url.includes('/wip')

  // --- 1. Логіка визначення пристрою та перевірки доступу ---
  const userAgent = headers.get('user-agent') || ''
  let deviceType: 'pc' | 'tablet' | 'mobile' = 'pc'

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
    deviceType = 'tablet'
  } else if (
      /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
          userAgent
      )
  ) {
    deviceType = 'mobile'
  }

  const pcEnabled = process.env.ACCESS_PC_ENABLED !== 'false'
  const tabletEnabled = process.env.ACCESS_TABLET_ENABLED !== 'false'
  const mobileEnabled = process.env.ACCESS_MOBILE_ENABLED !== 'false'

  let isAccessBlocked = false
  if (deviceType === 'pc' && !pcEnabled) isAccessBlocked = true
  if (deviceType === 'tablet' && !tabletEnabled) isAccessBlocked = true
  if (deviceType === 'mobile' && !mobileEnabled) isAccessBlocked = true

  if (isAccessBlocked && !isWipPage) {
    return NextResponse.redirect(new URL('/wip', url))
  }

  if (!isAccessBlocked && isWipPage) {
    return NextResponse.redirect(new URL(PathConfig.DASHBOARD, url))
  }

  if (isAccessBlocked) {
    return NextResponse.next()
  }
  const session = cookies.get('session')?.value
  const isAuthPage = url.includes(PathConfig.AUTH)

  if (isAuthPage) {
    if (session) {
      return NextResponse.redirect(new URL(PathConfig.DASHBOARD, url))
    }
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL(PathConfig.LOGIN, url))
  }

  return NextResponse.next()
}

// Оновлюємо matcher, щоб включити всі захищені сторінки та /wip
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/employees/:path*',
    '/profile/:path*',
    '/schedule/:path*',
    '/departments/:path*',
    '/auth/:path*',
    '/wip',
  ],
}