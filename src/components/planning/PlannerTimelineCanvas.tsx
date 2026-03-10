'use client'

import React from 'react'

export default function PlannerTimelineCanvas({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative flex-1 overflow-x-auto bg-gray-50">
      {children}
    </div>
  )
}
