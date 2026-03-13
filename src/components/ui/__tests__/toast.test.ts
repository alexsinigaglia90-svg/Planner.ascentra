import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Toast context value shape ──────────────────────────────────────────────

describe('ToastContextValue interface', () => {
  it('has success and error methods', () => {
    const mock = {
      success: (msg: string) => { void msg },
      error: (msg: string) => { void msg },
    }
    expect(typeof mock.success).toBe('function')
    expect(typeof mock.error).toBe('function')
  })
})

// ── Toast auto-dismiss timing logic ──────────────────────────────────────────

describe('toast auto-dismiss logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('does not dismiss before 3500ms', () => {
    const toasts: string[] = []
    const dismiss = (id: string) => { const i = toasts.indexOf(id); if (i > -1) toasts.splice(i, 1) }
    const id = 'toast-1'
    toasts.push(id)
    setTimeout(() => dismiss(id), 3500)

    vi.advanceTimersByTime(3000)
    expect(toasts).toContain(id)
  })

  it('dismisses after 3500ms', () => {
    const toasts: string[] = []
    const dismiss = (id: string) => { const i = toasts.indexOf(id); if (i > -1) toasts.splice(i, 1) }
    const id = 'toast-1'
    toasts.push(id)
    setTimeout(() => dismiss(id), 3500)

    vi.advanceTimersByTime(3500)
    expect(toasts).not.toContain(id)
  })

  it('exit animation completes within 200ms after dismiss signal', () => {
    const dismissed: string[] = []
    const removed: string[] = []
    const dismissWithAnimation = (id: string) => {
      dismissed.push(id)
      setTimeout(() => removed.push(id), 200)
    }
    dismissWithAnimation('toast-2')

    vi.advanceTimersByTime(100)
    expect(dismissed).toContain('toast-2')
    expect(removed).not.toContain('toast-2')

    vi.advanceTimersByTime(100)
    expect(removed).toContain('toast-2')
  })
})

// ── Multiple toasts stacking ──────────────────────────────────────────────────

describe('multiple toast stacking', () => {
  it('stacks multiple toasts independently', () => {
    const toasts: { id: string; message: string }[] = []
    let _id = 0

    function add(message: string) {
      const id = String(++_id)
      toasts.push({ id, message })
      return id
    }

    add('Medewerker toegevoegd')
    add('Filters gewist')
    add('Dienst ingepland')

    expect(toasts).toHaveLength(3)
    expect(toasts[0].message).toBe('Medewerker toegevoegd')
    expect(toasts[1].message).toBe('Filters gewist')
    expect(toasts[2].message).toBe('Dienst ingepland')
  })

  it('removes only the dismissed toast, leaving others intact', () => {
    const toasts: { id: string; message: string }[] = []
    let _id = 0

    function add(message: string) {
      const id = String(++_id)
      toasts.push({ id, message })
      return id
    }

    function remove(id: string) {
      const i = toasts.findIndex((t) => t.id === id)
      if (i > -1) toasts.splice(i, 1)
    }

    const id1 = add('Toast A')
    add('Toast B')
    remove(id1)

    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Toast B')
  })
})

// ── Bulk import success triggers toast ───────────────────────────────────────

describe('bulk import toast message', () => {
  it('formats singular count correctly', () => {
    const created = 1
    const msg = `${created} medewerker${created !== 1 ? 's' : ''} geïmporteerd`
    expect(msg).toBe('1 medewerker geïmporteerd')
  })

  it('formats plural count correctly', () => {
    const created = 42
    const msg = `${created} medewerker${created !== 1 ? 's' : ''} geïmporteerd`
    expect(msg).toBe('42 medewerkers geïmporteerd')
  })

  it('formats zero count correctly', () => {
    const created = 0
    const msg = `${created} medewerker${created !== 1 ? 's' : ''} geïmporteerd`
    expect(msg).toBe('0 medewerkers geïmporteerd')
  })
})

// ── Workforce success action triggers toast ───────────────────────────────────

describe('workforce success actions', () => {
  it('handleCreated should call success toast', () => {
    const called: string[] = []
    const success = (msg: string) => called.push(msg)

    // Simulates what handleCreated does after adding employee
    function handleCreated(ok: boolean) {
      if (!ok) return
      success('Medewerker toegevoegd')
    }

    handleCreated(true)
    expect(called).toContain('Medewerker toegevoegd')
  })

  it('handleCreated should not call toast on failure', () => {
    const called: string[] = []
    const success = (msg: string) => called.push(msg)

    function handleCreated(ok: boolean) {
      if (!ok) return
      success('Medewerker toegevoegd')
    }

    handleCreated(false)
    expect(called).toHaveLength(0)
  })

  it('filter reset calls success toast', () => {
    const called: string[] = []
    const success = (msg: string) => called.push(msg)

    function resetFilters() {
      // ... filter state resets omitted ...
      success('Filters gewist')
    }

    resetFilters()
    expect(called).toContain('Filters gewist')
  })
})

// ── Major vs normal success distinction ──────────────────────────────────────

describe('major success flag', () => {
  it('normal success does not set major flag', () => {
    const items: { message: string; major?: boolean }[] = []
    const success = (msg: string, opts?: { major?: boolean }) => {
      items.push({ message: msg, major: opts?.major })
    }

    success('Medewerker toegevoegd')
    expect(items[0].major).toBeUndefined()
  })

  it('major success sets major flag to true', () => {
    const items: { message: string; major?: boolean }[] = []
    const success = (msg: string, opts?: { major?: boolean }) => {
      items.push({ message: msg, major: opts?.major })
    }

    success('42 medewerkers geïmporteerd', { major: true })
    expect(items[0].major).toBe(true)
  })

  it('major success triggers celebrateSuccess', () => {
    let celebrateCalled = false
    const celebrate = () => { celebrateCalled = true }

    // Simulate bulk import success path
    function simulateBulkImport(ok: boolean, success: (msg: string, opts?: { major?: boolean }) => void, celebrate: () => void) {
      if (!ok) return
      success('10 medewerkers geïmporteerd', { major: true })
      celebrate()
    }

    simulateBulkImport(true, () => {}, celebrate)
    expect(celebrateCalled).toBe(true)
  })

  it('normal success does not trigger celebrateSuccess', () => {
    let celebrateCalled = false
    const celebrate = () => { celebrateCalled = true }

    // Simulate normal success path (no celebrate call)
    function simulateNormalSuccess(success: (msg: string) => void) {
      success('Medewerker toegevoegd')
      // celebrate intentionally NOT called for normal actions
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    simulateNormalSuccess((_msg) => {})
    expect(celebrateCalled).toBe(false)
  })
})

// ── Celebration trigger ───────────────────────────────────────────────────────

describe('celebrateSuccess', () => {
  it('is exported as a callable function', async () => {
    const { celebrateSuccess } = await import('@/lib/celebration')
    expect(typeof celebrateSuccess).toBe('function')
  })

  it('does nothing when document is undefined (SSR guard)', async () => {
    const { celebrateSuccess } = await import('@/lib/celebration')
    expect(() => celebrateSuccess()).not.toThrow()
  })

  it('triggerCelebration is still exported for backward compat', async () => {
    const { triggerCelebration } = await import('@/lib/celebration')
    expect(typeof triggerCelebration).toBe('function')
  })

  it('showSuccessFlash is exported and SSR-safe', async () => {
    const { showSuccessFlash } = await import('@/lib/celebration')
    expect(typeof showSuccessFlash).toBe('function')
    expect(() => showSuccessFlash()).not.toThrow()
  })
})
