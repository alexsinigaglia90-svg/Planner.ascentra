import { forwardRef } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text rendered above the input */
  label?: string
  /** Must be supplied so label[for] associates correctly */
  id: string
  /** Error message shown below the input */
  error?: string
}

/**
 * Labeled input field.
 *
 * - Label is always rendered ABOVE the input (no floating labels)
 * - height: 44px, border-radius: 10px
 * - Focus ring: 3px rgba(79,107,255,0.15)
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, error, className = '', ...props },
  ref,
) {
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={id} className="ds-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={['ds-input', error ? 'ds-input-error' : '', className].filter(Boolean).join(' ')}
        {...props}
      />
      {error && (
        <p className="ds-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export { Input }
