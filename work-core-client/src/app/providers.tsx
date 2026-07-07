'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PropsWithChildren, useEffect, useState } from 'react'
import ReactModal from 'react-modal'
import { ThemeApplier } from '@/app/components/ThemeApplier'

export function Providers({ children }: PropsWithChildren) {
    const [client] = useState(
        new QueryClient({
            defaultOptions: {
                queries: {
                    refetchOnWindowFocus: false,
                },
            },
        })
    )

    useEffect(() => {
        ReactModal.setAppElement('#modal-root')
    }, [])

    return (
        <QueryClientProvider client={client}>
            <ThemeApplier />
            {children}
        </QueryClientProvider>
    )
}