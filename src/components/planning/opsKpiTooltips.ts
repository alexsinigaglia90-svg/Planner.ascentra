/**
 * Tooltip text for every KPI tile in the Operations tab.
 * Pure data — no React, no side-effects. Imported by OperationsView and tests.
 */
export const OPS_KPI_TOOLTIPS = {
  'Open positions':  'Aantal dienst-plekken zonder toegewezen medewerker deze week.',
  'Critical slots':  'Diensten met nul toegewezen medewerkers — directe actie vereist.',
  'Understaffed':    'Aantal shifts met minder personeel ingepland dan minimaal vereist.',
  'Coverage':        'Percentage van shifts met voldoende personeel.',
  'Temp ratio':      'Aandeel uitzendkrachten in de totale directe inzet deze week.',
  'Over-contract':   'Medewerkers die meer uren ingepland staan dan hun contracturen.',
  'Overhead':        'Toegewezen overhead medewerkers in de huidige week.',
} as const

export type OpsKpiLabel = keyof typeof OPS_KPI_TOOLTIPS
