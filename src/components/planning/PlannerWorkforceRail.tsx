'use client'

import React from 'react'

export default function PlannerWorkforceRail({ children }: { children?: React.ReactNode }) {
  return (
    <div className="sticky left-0 top-[48px] z-20 bg-white border-r border-gray-200 min-w-[180px] max-w-[220px] flex flex-col px-2 py-2">
      {children}
    </div>
  )
}
