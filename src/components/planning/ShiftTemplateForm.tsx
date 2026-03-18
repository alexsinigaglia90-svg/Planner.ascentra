'use client'

import { useRef, useState, useTransition } from 'react'
import { createShiftTemplateAction } from '@/app/shifts/actions'
import { useToast } from '@/components/ui'

interface Props {
  onCreated?: () => void
}

export default function ShiftTemplateForm({ onCreated }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const { success, error: toastError } = useToast()
  const [nameError, setNameError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = (formData.get('name') as string ?? '').trim()
    if (!name) {
      setNameError('Naam is verplicht')
      return
    }
    setNameError(null)

    startTransition(async () => {
      try {
        await createShiftTemplateAction(formData)
        formRef.current?.reset()
        success('Template aangemaakt')
        onCreated?.()
      } catch {
        toastError('Template aanmaken mislukt')
      }
    })
  }

  return (
    <div className="rounded-2xl border border-[#4F6BFF]/20 bg-[#4F6BFF]/[0.02] p-5">
      <h2 className="text-sm font-bold text-gray-900 mb-4">Nieuwe shift template</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1" htmlFor="name">Naam</label>
          <input id="name" name="name" type="text" required placeholder="bv. Ochtend"
            aria-invalid={nameError ? true : undefined}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 ${nameError ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#4F6BFF]/40'}`}
            onChange={() => nameError && setNameError(null)}
          />
          {nameError && <p className="text-[10px] text-red-600 mt-0.5">{nameError}</p>}
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1" htmlFor="startTime">Start</label>
          <input id="startTime" name="startTime" type="time" required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40" />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1" htmlFor="endTime">Einde</label>
          <input id="endTime" name="endTime" type="time" required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40" />
        </div>
        <input type="hidden" name="requiredEmployees" value="1" />
        <div className="sm:col-span-4 flex justify-end">
          <button type="submit" disabled={isPending}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
            {isPending ? 'Aanmaken...' : 'Template aanmaken'}
          </button>
        </div>
      </form>
    </div>
  )
}
