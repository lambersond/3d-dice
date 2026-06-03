'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function SessionWrapper({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <NextThemesProvider
      attribute='class'
      defaultTheme='system'
      enableSystem
      disableTransitionOnChange
    >
      <main className='bg-page font-sans h-screen overflow-hidden'>
        <div className='flex flex-col h-full'>{children}</div>
      </main>
    </NextThemesProvider>
  )
}
