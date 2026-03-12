/**
 * Unit tests for the Operations tab KPI tooltip data.
 *
 * These tests run in the Node environment (no DOM) and verify that:
 *  - every visible KPI tile has a defined, non-empty tooltip text
 *  - the Coverage tooltip matches the product spec exactly
 *  - the Understaffed tooltip describes too-little-staffing
 *  - tooltip texts are valid, non-empty strings
 *
 * Hover/focus behaviour is provided by the shared Tooltip component
 * (src/components/ui/Tooltip.tsx) and covered by its own interaction
 * contract; here we only validate the data layer.
 */

import { describe, it, expect } from 'vitest'
import { OPS_KPI_TOOLTIPS } from '@/components/planning/opsKpiTooltips'

// Every label that StatTile renders in the Operations KPI strip.
const ALL_KPI_LABELS = [
  'Open positions',
  'Critical slots',
  'Understaffed',
  'Coverage',
  'Temp ratio',
  'Over-contract',
  'Overhead',
] as const

describe('OPS_KPI_TOOLTIPS', () => {
  it('defines a tooltip for every Operations KPI label', () => {
    for (const label of ALL_KPI_LABELS) {
      expect(
        OPS_KPI_TOOLTIPS[label],
        `Missing tooltip for KPI tile: "${label}"`,
      ).toBeTruthy()
    }
  })

  it('all tooltip texts are non-empty strings', () => {
    for (const [key, text] of Object.entries(OPS_KPI_TOOLTIPS)) {
      expect(typeof text, `"${key}" tooltip must be a string`).toBe('string')
      expect((text as string).trim().length, `"${key}" tooltip must not be empty`).toBeGreaterThan(0)
    }
  })

  it('Coverage tooltip matches product spec', () => {
    expect(OPS_KPI_TOOLTIPS['Coverage']).toBe(
      'Percentage van shifts met voldoende personeel.',
    )
  })

  it('Understaffed tooltip describes insufficient staffing', () => {
    expect(OPS_KPI_TOOLTIPS['Understaffed']).toMatch(/minder|te weinig|tekort|insufficient/i)
  })

  it('Critical slots tooltip signals urgency', () => {
    expect(OPS_KPI_TOOLTIPS['Critical slots']).toMatch(/nul|zero|directe actie|critical/i)
  })

  it('Open positions tooltip references a week context', () => {
    expect(OPS_KPI_TOOLTIPS['Open positions']).toMatch(/week/i)
  })
})
