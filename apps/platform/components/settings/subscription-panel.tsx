'use client'

import { useState, useEffect } from 'react'
import { Button } from '@zequel/ui/components/button'
import { Separator } from '@zequel/ui/components/separator'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubscriptionPanelProps {
  userId: string
}

interface Subscription {
  plan: 'free' | 'premium_lite' | 'premium_pro'
  status: string
  request_limit?: number
  expires_at?: string | null
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for getting started',
    features: [
      '20 AI requests per day',
      '3 document uploads',
      'Basic study mode',
      'Standard response speed',
      'Community support',
      'Limited workspace history',
    ],
    limitations: [
      'Limited to 10MB files',
      'No research mode',
      'No multi-document analysis',
    ],
  },
  {
    id: 'premium_lite',
    name: 'Premium Lite',
    price: '$2.99',
    period: '/month',
    description: 'For regular researchers',
    popular: true,
    features: [
      '200 AI requests per day',
      '30 document uploads',
      'Advanced study mode',
      'Research mode access',
      'Multi-document analysis',
      'Priority response speed',
      'Email support',
      'Extended file size (50MB)',
      'Citation export',
      'Full workspace history',
      'Advanced research tools',
    ],
    limitations: [],
  },
  {
    id: 'premium_pro',
    name: 'Premium Pro',
    price: '$5.99',
    period: '/month',
    description: 'For power users',
    features: [
      '1,000 AI requests per day',
      '100 document uploads',
      'Advanced+ study mode',
      'Research mode access',
      'Multi-document analysis',
      'Highest priority speed',
      'Priority support',
      'Extended file size (100MB)',
      'Citation export',
      'Full workspace history',
      'Advanced research tools',
      'Early access features',
      'API access (coming soon)',
      'Team collaboration (coming soon)',
    ],
    limitations: [],
  },
] as const

type PlanId = (typeof PLANS)[number]['id']

export function SubscriptionPanel({ userId }: SubscriptionPanelProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState<PlanId | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/subscription')
      if (!res.ok) throw new Error('Failed to fetch subscription')
      const data = await res.json()
      setSubscription(data.subscription)
    } catch (err) {
      console.error('Failed to fetch subscription:', err)
      // Default to free plan on error
      setSubscription({ plan: 'free', status: 'active' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async (planId: PlanId) => {
    if (planId === subscription?.plan) return
    
    setIsUpgrading(planId)
    setError('')
    setSuccess('')
    
    try {
      const res = await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update subscription')
      }
      
      setSubscription(data.subscription)
      const planName = PLANS.find((p) => p.id === planId)?.name ?? planId
      setSuccess(planId === 'free' ? 'Downgraded to Free plan' : `Upgraded to ${planName} plan!`)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setIsUpgrading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentPlan = subscription?.plan || 'free'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Subscription
        </h2>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Manage your subscription plan and billing.
        </p>
      </div>

      {/* Current Plan Badge */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Current Plan</p>
          <p className="font-sans text-lg font-semibold text-foreground capitalize">{currentPlan.replace('_', ' ')}</p>
        </div>
        {subscription?.expires_at && (
          <div className="ml-auto text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Renews</p>
            <p className="font-sans text-sm text-foreground">
              {new Date(subscription.expires_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-500">
          {success}
        </div>
      )}

      <Separator />

      {/* Plans Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id
          const isUpgradingThis = isUpgrading === plan.id

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-xl border p-5 transition-all',
                isCurrentPlan
                  ? 'border-foreground bg-foreground/5'
                  : 'border-border bg-background hover:border-foreground/30'
              )}
            >
              {'popular' in plan && plan.popular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider text-background">
                  Popular
                </div>
              )}

              <div>
                <h3 className="font-mono text-sm font-semibold text-foreground">{plan.name}</h3>
                <p className="mt-0.5 font-sans text-xs text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-sans text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="font-mono text-xs text-muted-foreground">{plan.period}</span>
              </div>

              <Separator className="my-4" />

              <ul className="flex-1 space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
                    <span className="font-sans text-xs text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrentPlan || isUpgrading !== null}
                className={cn(
                  'mt-5 h-9 w-full font-mono text-[11px] uppercase tracking-wider',
                  isCurrentPlan
                    ? 'bg-foreground/10 text-foreground hover:bg-foreground/10'
                    : 'bg-foreground text-background hover:bg-foreground/90'
                )}
              >
                {isUpgradingThis ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrentPlan ? (
                  'Current Plan'
                ) : currentPlan !== 'free' && plan.id === 'free' ? (
                  'Downgrade'
                ) : (
                  'Upgrade'
                )}
              </Button>
            </div>
          )
        })}
      </div>

      <Separator />

      {/* Additional Info */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Note
        </p>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          Plan changes take effect immediately. For enterprise features or custom requirements, 
          please contact our team at <span className="text-foreground">support@zequel.xyz</span>
        </p>
      </div>
    </div>
  )
}
