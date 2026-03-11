interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Constrains page content to 1400px max-width with 32px padding
 * per the design system layout spec.
 */
export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div
      className={['mx-auto w-full max-w-[1400px] px-8 py-8', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}

/**
 * Thin horizontal divider for sections within a page.
 */
export function PageSection({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={['space-y-6', className].filter(Boolean).join(' ')}>{children}</section>
  )
}
