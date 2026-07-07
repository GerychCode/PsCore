import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.scss'
import { Providers } from '@/app/providers'
import { Toaster } from 'sonner'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WorkCore',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='uk' suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('workcore-theme'));if(t&&t.state&&t.state.theme==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${montserrat.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster position='bottom-center' duration={1500} />
          <div id='modal-root' />
        </Providers>
      </body>
    </html>
  )
}