'use client'
import { useState } from 'react'
import { FiChevronsLeft, FiChevronsRight } from 'react-icons/fi'

export default function PaginationSlider({ totalPages = 300 }) {
  const [currentPage, setCurrentPage] = useState(1)

  const switchPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page)
  }

  const generatePages = (): (number | null)[] => {
    const pages: (number | null)[] = []

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      while (pages.length < 5) pages.push(null)
      return pages
    }

    if (currentPage <= 3) {
      pages.push(1, 2, 3, totalPages - 1, totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, 2, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, currentPage - 1, currentPage, currentPage + 1, totalPages)
    }

    const uniqueSorted = Array.from(new Set(pages)).sort(
      (a, b) => (a ?? 0) - (b ?? 0)
    )

    while (uniqueSorted.length < 5) uniqueSorted.splice(1, 0, null)

    return uniqueSorted.slice(0, 5)
  }

  return (
    <div className='flex flex-row items-center justify-center w-full h-10 gap-1 [&>*]:border [&>*]:border-primary'>
      <button
        disabled={currentPage <= 1}
        onClick={() => switchPage(currentPage - 1)}
        className='h-full aspect-square text-xl text-primary hover:opacity-75 rounded-full p-2 flex items-center justify-center disabled:opacity-50'
      >
        <FiChevronsLeft />
      </button>

      <div className='flex flex-row items-center justify-between h-full rounded-full p-1 gap-1 bg-primary/20 min-w-[200px]'>
        {generatePages().map((page, index) =>
          page ? (
            <button
              key={index}
              onClick={() => switchPage(page)}
              className={`h-full aspect-square rounded-full flex items-center justify-center px-3 transition-all ${
                page === currentPage ? 'text-white bg-primary' : 'text-primary'
              }`}
            >
              {page}
            </button>
          ) : (
            <div
              key={index}
              className='h-full aspect-square rounded-full px-3 flex items-center justify-center opacity-0 pointer-events-none'
            >
              0
            </div>
          )
        )}
      </div>

      <button
        disabled={currentPage >= totalPages}
        onClick={() => switchPage(currentPage + 1)}
        className='h-full aspect-square text-xl text-primary hover:opacity-75 rounded-full p-2 flex items-center justify-center disabled:opacity-50'
      >
        <FiChevronsRight />
      </button>
    </div>
  )
}
