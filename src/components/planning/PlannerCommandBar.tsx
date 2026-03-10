'use client'

import React from 'react'

export default function PlannerCommandBar({ children }: { children?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 w-full bg-white border-b border-gray-200 shadow-sm flex items-center px-4 py-2 gap-3">
      {children}
    </div>
  )
}
