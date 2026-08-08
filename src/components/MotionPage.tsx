import { useEffect, useRef, useState, type AnimationEvent, type ReactNode } from 'react'

type Variant = 'fade-up' | 'fade' | 'pop' | 'slide-left' | 'slide-right' | 'none'

type Props = {
  motionKey: string
  variant?: Variant
  className?: string
  /** Skip enter animation on first mount (parent App MotionPage already animates). */
  skipMountAnimation?: boolean
  children: ReactNode
}

const variantClass: Record<Variant, string> = {
  'fade-up': 'motion-page motion-page--fade-up',
  fade: 'motion-page motion-page--fade',
  pop: 'motion-page motion-page--pop',
  'slide-left': 'motion-page motion-page--slide-left',
  'slide-right': 'motion-page motion-page--slide-right',
  none: 'motion-page motion-page--none',
}

function MotionPageSurface({
  variant,
  className,
  children,
}: {
  variant: Variant
  className: string
  children: ReactNode
}) {
  const [settled, setSettled] = useState(variant === 'none')

  useEffect(() => {
    if (variant === 'none' || settled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSettled(true)
      return
    }
    /* Safety: drop will-change if animationend is skipped (display:none, etc.) */
    const timer = window.setTimeout(() => setSettled(true), 700)
    return () => window.clearTimeout(timer)
  }, [variant, settled])

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    setSettled(true)
  }

  const classes = settled
    ? `motion-page motion-page--settled ${className}`.trim()
    : `${variantClass[variant]} ${className}`.trim()

  return (
    <div className={classes} onAnimationEnd={handleAnimationEnd}>
      {children}
    </div>
  )
}

export function MotionPage({
  motionKey,
  variant = 'fade-up',
  className = '',
  skipMountAnimation = false,
  children,
}: Props) {
  const skipNext = useRef(skipMountAnimation)

  useEffect(() => {
    skipNext.current = false
  }, [motionKey])

  const activeVariant = skipNext.current ? 'none' : variant

  return (
    <MotionPageSurface key={motionKey} variant={activeVariant} className={className ?? ''}>
      {children}
    </MotionPageSurface>
  )
}
