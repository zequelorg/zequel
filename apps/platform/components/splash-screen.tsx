'use client'

import { useEffect, useState } from 'react'

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 800)
    const exitTimer = setTimeout(() => setPhase('exit'), 2400)
    const doneTimer = setTimeout(() => onComplete(), 3400)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete])

  const letters = 'ZEQUEL'.split('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      style={{
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 1s ease-in-out',
      }}
    >
      <div className="flex items-baseline gap-[0.06em]">
        {letters.map((letter, i) => (
          <span
            key={i}
            className="inline-block font-mono text-4xl font-semibold tracking-[0.2em] text-foreground sm:text-5xl"
            style={{
              opacity: phase === 'enter' ? 0 : 1,
              transform:
                phase === 'enter'
                  ? 'translateY(16px)'
                  : 'translateY(0)',
              transition: `opacity 0.6s ease-out ${i * 0.1}s, transform 0.6s ease-out ${i * 0.1}s`,
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      <span
        className="absolute bottom-12 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
        style={{
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity 0.6s ease-in-out 0.3s',
        }}
      >
        Absalex Labs
      </span>
    </div>
  )
}
