import type { ReactNode } from 'react'

type Variant = 'fade-up' | 'fade' | 'pop' | 'slide-left' | 'slide-right'

type Props = {
  motionKey: string
  variant?: Variant
  className?: string
  children: ReactNode
}

const variantClass: Record<Variant, string> = {
  'fade-up': 'motion-page',
  fade: 'motion-page motion-page--fade',
  pop: 'motion-page motion-page--pop',
  'slide-left': 'motion-page motion-page--slide-left',
  'slide-right': 'motion-page motion-page--slide-right',
}

export function MotionPage({
  motionKey,
  variant = 'fade-up',
  className = '',
  children,
}: Props) {
  return (
    <div key={motionKey} className={`${variantClass[variant]} ${className}`.trim()}>
      {children}
    </div>
  )
}
