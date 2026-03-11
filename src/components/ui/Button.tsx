import { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'md' | 'sm'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'ds-btn-primary',
  secondary: 'ds-btn-secondary',
  ghost: 'ds-btn-ghost',
}

const SIZE: Record<ButtonSize, string> = {
  md: '',
  sm: 'ds-btn-sm',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, type = 'button', ...props },
  ref,
) {
  const classes = ['ds-btn', VARIANT[variant], SIZE[size], className]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} type={type} className={classes} {...props}>
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export { Button }
