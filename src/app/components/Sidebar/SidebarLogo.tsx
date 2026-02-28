import { motion } from 'framer-motion'
import Image from 'next/image'

interface SidebarLogoProps {
    collapsed: boolean
}

export function SidebarLogo({ collapsed }: SidebarLogoProps) {
    return (
        <div className={`h-16 flex items-center justify-center`}>
            <motion.div
                layout
                className='relative'
                style={{
                    width: collapsed ? 45 : 120,
                }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
                <Image
                    src='/logo.svg'
                    alt='Лого'
                    width={120}
                    height={45}
                    style={{
                        height: 'auto',
                        width: '100%',
                    }}
                    priority
                />
            </motion.div>
        </div>
    )
}