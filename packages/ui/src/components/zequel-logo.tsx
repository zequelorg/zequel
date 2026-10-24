export function ZequelLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <span className="font-mono text-sm font-semibold tracking-[0.2em] text-foreground uppercase">
        Zequel
      </span>
    </div>
  )
}

export function ZequelLogoFull({ className }: { className?: string }) {
  return (
    <div className={className}>
      <span className="font-mono text-base font-semibold tracking-[0.2em] text-foreground uppercase">
        Zequel
      </span>
      <span className="mt-1 block font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
        Research System
      </span>
    </div>
  )
}
