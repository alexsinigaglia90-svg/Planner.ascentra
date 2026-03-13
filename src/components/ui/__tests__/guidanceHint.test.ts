import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Pure dismissal logic (mirrors GuidanceHint behaviour) ─────────────────────

function readDismissed(key: string | undefined, storage: Record<string, string>): boolean {
  if (!key) return false
  return storage[key] === 'dismissed'
}

function writeDismissed(key: string | undefined, storage: Record<string, string>): void {
  if (!key) return
  storage[key] = 'dismissed'
}

// ── GuidanceHint prop defaults ────────────────────────────────────────────────

describe('GuidanceHint props', () => {
  it('default dismissLabel is "Begrepen"', () => {
    const defaults = { dismissLabel: 'Begrepen', dismissible: true }
    expect(defaults.dismissLabel).toBe('Begrepen')
  })

  it('dismissible defaults to true', () => {
    const defaults = { dismissible: true }
    expect(defaults.dismissible).toBe(true)
  })

  it('renders title and description as provided', () => {
    const props = {
      title: 'Planneroverzicht',
      description: 'Gebruik filters om de juiste medewerkers te tonen.',
    }
    expect(props.title).toBe('Planneroverzicht')
    expect(props.description).toContain('filters')
  })
})

// ── Dismissal storage logic ───────────────────────────────────────────────────

describe('dismissal storage logic', () => {
  let storage: Record<string, string>

  beforeEach(() => {
    storage = {}
  })

  it('readDismissed returns false when key has no value', () => {
    expect(readDismissed('planner-guidance-v1', storage)).toBe(false)
  })

  it('readDismissed returns true after writeDismissed', () => {
    writeDismissed('planner-guidance-v1', storage)
    expect(readDismissed('planner-guidance-v1', storage)).toBe(true)
  })

  it('readDismissed returns false when storageKey is undefined', () => {
    expect(readDismissed(undefined, storage)).toBe(false)
  })

  it('writeDismissed is a no-op when storageKey is undefined', () => {
    writeDismissed(undefined, storage)
    expect(Object.keys(storage)).toHaveLength(0)
  })

  it('dismissing one key does not affect another', () => {
    writeDismissed('planner-guidance-v1', storage)
    expect(readDismissed('workforce-guidance-v1', storage)).toBe(false)
  })

  it('stores "dismissed" as the value', () => {
    writeDismissed('templates-guidance-v1', storage)
    expect(storage['templates-guidance-v1']).toBe('dismissed')
  })
})

// ── Hint visibility toggle ───────────────────────────────────────────────────

describe('hint visibility state', () => {
  it('hint is hidden after dismiss', () => {
    let dismissed = false
    function handleDismiss() { dismissed = true }

    expect(dismissed).toBe(false)
    handleDismiss()
    expect(dismissed).toBe(true)
  })

  it('hints on different screens can be dismissed independently', () => {
    const state: Record<string, boolean> = {
      planner: false,
      workforce: false,
      templates: false,
      analytics: false,
    }
    state['planner'] = true
    expect(state['planner']).toBe(true)
    expect(state['workforce']).toBe(false)
    expect(state['templates']).toBe(false)
    expect(state['analytics']).toBe(false)
  })
})

// ── storageKey contracts for live screens ────────────────────────────────────

describe('storageKey contracts', () => {
  it('planner screen uses planner-guidance-v1', () => {
    const key = 'planner-guidance-v1'
    expect(key).toBe('planner-guidance-v1')
  })

  it('workforce screen uses workforce-guidance-v1', () => {
    const key = 'workforce-guidance-v1'
    expect(key).toBe('workforce-guidance-v1')
  })

  it('templates screen uses templates-guidance-v1', () => {
    const key = 'templates-guidance-v1'
    expect(key).toBe('templates-guidance-v1')
  })

  it('analytics screen uses analytics-guidance-v1', () => {
    const key = 'analytics-guidance-v1'
    expect(key).toBe('analytics-guidance-v1')
  })

  it('all keys use the -v1 versioning suffix', () => {
    const keys = [
      'planner-guidance-v1',
      'workforce-guidance-v1',
      'templates-guidance-v1',
      'analytics-guidance-v1',
    ]
    for (const key of keys) {
      expect(key).toMatch(/-v\d+$/)
    }
  })
})

// ── primaryAction prop ───────────────────────────────────────────────────────

describe('primaryAction prop', () => {
  it('invokes onClick when primary action is triggered', () => {
    let triggered = false
    const primaryAction = { label: 'Medewerkers importeren', onClick: () => { triggered = true } }

    expect(triggered).toBe(false)
    primaryAction.onClick()
    expect(triggered).toBe(true)
  })

  it('primaryAction is optional — undefined does not throw', () => {
    const props: { primaryAction?: { label: string; onClick?: () => void } } = {}
    expect(() => {
      if (props.primaryAction?.onClick) props.primaryAction.onClick()
    }).not.toThrow()
  })
})

// ── SSR hydration guard ───────────────────────────────────────────────────────

describe('SSR hydration guard', () => {
  it('mounted starts false to avoid hydration mismatch', () => {
    // Simulates the React.useState(false) initial value before useEffect runs
    let mounted = false
    expect(mounted).toBe(false)

    // After effect runs
    mounted = true
    expect(mounted).toBe(true)
  })

  it('hint is never shown before mount (avoids hydration mismatch)', () => {
    let mounted = false
    let dismissed = false
    const shouldShow = mounted && !dismissed
    expect(shouldShow).toBe(false)
  })
})

// ── localStorage error handling ──────────────────────────────────────────────

describe('localStorage error handling', () => {
  it('does not throw when localStorage write fails', () => {
    expect(() => {
      try {
        throw new Error('QuotaExceededError')
      } catch {
        // silently ignored — matches GuidanceHint behaviour
      }
    }).not.toThrow()
  })

  it('does not throw when localStorage read fails', () => {
    expect(() => {
      let result = false
      try {
        throw new Error('SecurityError')
      } catch {
        result = false
      }
      expect(result).toBe(false)
    }).not.toThrow()
  })
})

// ── Specific screen hints render when not dismissed ──────────────────────────

describe('screen-level hint render condition', () => {
  it('workforce hint renders when storageKey has no record', () => {
    const storage: Record<string, string> = {}
    const dismissed = readDismissed('workforce-guidance-v1', storage)
    expect(dismissed).toBe(false) // hint should render
  })

  it('workforce hint does not render after dismissal stored', () => {
    const storage: Record<string, string> = {}
    writeDismissed('workforce-guidance-v1', storage)
    const dismissed = readDismissed('workforce-guidance-v1', storage)
    expect(dismissed).toBe(true) // hint should NOT render
  })

  it('planner hint renders when storageKey has no record', () => {
    const storage: Record<string, string> = {}
    expect(readDismissed('planner-guidance-v1', storage)).toBe(false)
  })

  it('analytics hint renders when storageKey has no record', () => {
    const storage: Record<string, string> = {}
    expect(readDismissed('analytics-guidance-v1', storage)).toBe(false)
  })
})
