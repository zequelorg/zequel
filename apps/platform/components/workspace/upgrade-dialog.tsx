'use client'

import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@zequel/ui/components/dialog'
import { Button } from '@zequel/ui/components/button'
import { Check, ArrowRight } from 'lucide-react'

export type RequiredPlan = 'premium_lite' | 'premium_pro'

const PLAN_DETAILS: Record<RequiredPlan, { name: string; price: string; perks: string[] }> = {
  premium_lite: {
    name: 'Premium Lite',
    price: '$2.99/mo',
    perks: [
      'Research mode access',
      'Multi-document analysis',
      '200 AI requests per day',
    ],
  },
  premium_pro: {
    name: 'Premium Pro',
    price: '$5.99/mo',
    perks: [
      'Everything in Premium Lite',
      'Coding mode & deep reasoning',
      '1,000 AI requests per day',
    ],
  },
}

interface UpgradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The feature the user tried to use, e.g. "Research Mode" */
  featureName?: string
  /** The lowest plan that unlocks the feature */
  requiredPlan?: RequiredPlan
  /** Optional message returned from the server */
  message?: string
}

export function UpgradeDialog({
  open,
  onOpenChange,
  featureName,
  requiredPlan = 'premium_lite',
  message,
}: UpgradeDialogProps) {
  const router = useRouter()
  const plan = PLAN_DETAILS[requiredPlan] ?? PLAN_DETAILS.premium_lite

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md border-border bg-background p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-col gap-1.5 border-b border-border px-6 py-6 text-center">
          <DialogTitle className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
            Upgrade Required
          </DialogTitle>
          <DialogDescription className="font-sans text-sm text-muted-foreground text-pretty">
            {message ||
              `${featureName || 'This feature'} is part of the ${plan.name} plan. Upgrade to unlock it.`}
          </DialogDescription>
        </div>

        {/* Plan card */}
        <div className="px-6 py-5">
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                {plan.name}
              </span>
              <span className="font-sans text-base font-bold text-foreground">{plan.price}</span>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {plan.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                  <span className="font-sans text-xs text-muted-foreground">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-border px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 flex-1 rounded-md border-border font-mono text-[11px] uppercase tracking-wider"
          >
            Not Now
          </Button>
          <Button
            onClick={() => router.push('/settings?tab=subscription')}
            className="h-9 flex-1 gap-2 rounded-md bg-foreground font-mono text-[11px] uppercase tracking-wider text-background hover:bg-foreground/90"
          >
            View Plans
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
