// Types for the Website CMS module of the Zequel Control Center.
// Presentation-only: these mirror the shape the public website would consume
// once wired to the database. UI here is intentionally backend-agnostic.

export type PublishStatus = "published" | "draft" | "scheduled" | "archived"

export interface CmsPage {
  id: string
  title: string
  slug: string
  status: PublishStatus
  seoTitle: string
  seoDescription: string
  sections: number
  updatedAt: string
  updatedBy: string
}

export interface HeroSection {
  id: string
  page: string
  eyebrow: string
  headline: string
  subhead: string
  primaryCtaLabel: string
  primaryCtaHref: string
  secondaryCtaLabel: string
  secondaryCtaHref: string
  status: PublishStatus
  updatedAt: string
}

export interface FeatureItem {
  id: string
  title: string
  description: string
  icon: string
  group: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export interface PricingPlan {
  id: string
  name: string
  priceMonthly: number
  priceYearly: number
  description: string
  features: string[]
  highlighted: boolean
  ctaLabel: string
  status: PublishStatus
  order: number
  updatedAt: string
}

export interface DocArticle {
  id: string
  title: string
  slug: string
  category: string
  status: PublishStatus
  readingMinutes: number
  order: number
  updatedAt: string
  updatedBy: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  author: string
  tags: string[]
  status: PublishStatus
  publishedAt: string | null
  updatedAt: string
  views: number
}

export type ChangelogType = "feature" | "improvement" | "fix" | "security"

export interface ChangelogEntry {
  id: string
  version: string
  title: string
  type: ChangelogType
  body: string
  status: PublishStatus
  releasedAt: string
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export type MessageStatus = "new" | "read" | "replied" | "archived"

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string
  message: string
  status: MessageStatus
  createdAt: string
}

export type RequestStatus = "open" | "planned" | "in_progress" | "shipped" | "declined"

export interface FeatureRequest {
  id: string
  title: string
  description: string
  requester: string
  email: string
  votes: number
  status: RequestStatus
  createdAt: string
}

export type BugSeverity = "low" | "medium" | "high" | "critical"
export type BugStatus = "new" | "triaged" | "in_progress" | "resolved" | "wont_fix"

export interface CmsBugReport {
  id: string
  title: string
  description: string
  reporter: string
  email: string
  severity: BugSeverity
  status: BugStatus
  url: string
  createdAt: string
}

export interface StatItem {
  id: string
  value: string
  label: string
  group: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export interface StepItem {
  id: string
  step: string
  title: string
  body: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export interface TestimonialItem {
  id: string
  quote: string
  name: string
  role: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export interface PrincipleItem {
  id: string
  title: string
  body: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export interface PillarPoint {
  icon: string
  text: string
}

export interface PillarItem {
  id: string
  label: string
  title: string
  body: string
  points: PillarPoint[]
  image: string
  url: string
  order: number
  status: PublishStatus
  updatedAt: string
}

export interface AboutStory {
  id: string
  body: string
  status: PublishStatus
  updatedAt: string
}

export type MediaType = "image" | "video" | "document" | "icon"

export interface MediaAsset {
  id: string
  name: string
  type: MediaType
  url: string
  sizeKb: number
  width?: number
  height?: number
  uploadedBy: string
  uploadedAt: string
}
