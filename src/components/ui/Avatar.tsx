export interface AvatarProps {
  name: string
  size?: 'sm' | 'md'
  dark?: boolean
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Avatar({ name, size = 'md', dark = false, className = '' }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'ds-avatar-sm' : ''
  const themeClass = dark ? 'ds-avatar-dark' : ''
  return (
    <span className={`ds-avatar ${sizeClass} ${themeClass} ${className}`} aria-label={name}>
      {getInitials(name)}
    </span>
  )
}
