// Declarative registry that maps each Website CMS resource to its database
// table and the field transforms between the snake_case DB rows and the
// camelCase models used by the admin UI.
//
// This module is intentionally framework-agnostic (no React, no server-only
// imports) so it can be shared by the generic API route handlers and the
// client-side data hooks.

export interface CmsColumn {
  /** camelCase key on the client model */
  model: string
  /** snake_case column in the database */
  col: string
  /** stored as JSONB array */
  json?: boolean
  /** coerce to number when reading */
  number?: boolean
  /** coerce to boolean when reading */
  boolean?: boolean
  /** read-only: never written back (e.g. server-managed timestamps) */
  readOnly?: boolean
}

export interface CmsResourceConfig {
  table: string
  /** columns that make up the editable / readable model (excluding id) */
  columns: CmsColumn[]
  /** default ordering for list queries */
  orderBy: { col: string; ascending: boolean }
  /** columns used for ilike search */
  searchable: string[]
  /** whether the table has an updated_at column to stamp on writes */
  hasUpdatedAt: boolean
}

export type CmsRow = Record<string, unknown>
export type CmsModel = Record<string, unknown>

export const CMS_RESOURCES: Record<string, CmsResourceConfig> = {
  pages: {
    table: "cms_pages",
    orderBy: { col: "updated_at", ascending: false },
    searchable: ["title", "slug"],
    hasUpdatedAt: true,
    columns: [
      { model: "title", col: "title" },
      { model: "slug", col: "slug" },
      { model: "status", col: "status" },
      { model: "seoTitle", col: "seo_title" },
      { model: "seoDescription", col: "seo_description" },
      { model: "sections", col: "sections", number: true },
      { model: "updatedBy", col: "updated_by" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  hero: {
    table: "cms_hero_sections",
    orderBy: { col: "updated_at", ascending: false },
    searchable: ["page", "headline"],
    hasUpdatedAt: true,
    columns: [
      { model: "page", col: "page" },
      { model: "eyebrow", col: "eyebrow" },
      { model: "headline", col: "headline" },
      { model: "subhead", col: "subhead" },
      { model: "primaryCtaLabel", col: "primary_cta_label" },
      { model: "primaryCtaHref", col: "primary_cta_href" },
      { model: "secondaryCtaLabel", col: "secondary_cta_label" },
      { model: "secondaryCtaHref", col: "secondary_cta_href" },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  features: {
    table: "cms_feature_items",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["title", "description"],
    hasUpdatedAt: true,
    columns: [
      { model: "title", col: "title" },
      { model: "description", col: "description" },
      { model: "icon", col: "icon" },
      { model: "group", col: "group_name" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  pricing: {
    table: "cms_pricing_plans",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["name", "description"],
    hasUpdatedAt: true,
    columns: [
      { model: "name", col: "name" },
      { model: "priceMonthly", col: "price_monthly", number: true },
      { model: "priceYearly", col: "price_yearly", number: true },
      { model: "description", col: "description" },
      { model: "features", col: "features", json: true },
      { model: "highlighted", col: "highlighted", boolean: true },
      { model: "ctaLabel", col: "cta_label" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  docs: {
    table: "cms_doc_articles",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["title", "slug", "category"],
    hasUpdatedAt: true,
    columns: [
      { model: "title", col: "title" },
      { model: "slug", col: "slug" },
      { model: "category", col: "category" },
      { model: "status", col: "status" },
      { model: "readingMinutes", col: "reading_minutes", number: true },
      { model: "order", col: "sort_order", number: true },
      { model: "updatedBy", col: "updated_by" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  blog: {
    table: "cms_blog_posts",
    orderBy: { col: "updated_at", ascending: false },
    searchable: ["title", "slug", "author"],
    hasUpdatedAt: true,
    columns: [
      { model: "title", col: "title" },
      { model: "slug", col: "slug" },
      { model: "excerpt", col: "excerpt" },
      { model: "author", col: "author" },
      { model: "tags", col: "tags", json: true },
      { model: "status", col: "status" },
      { model: "publishedAt", col: "published_at" },
      { model: "views", col: "views", number: true },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  changelog: {
    table: "cms_changelog_entries",
    orderBy: { col: "released_at", ascending: false },
    searchable: ["version", "title"],
    hasUpdatedAt: true,
    columns: [
      { model: "version", col: "version" },
      { model: "title", col: "title" },
      { model: "type", col: "type" },
      { model: "body", col: "body" },
      { model: "status", col: "status" },
      { model: "releasedAt", col: "released_at" },
    ],
  },
  faq: {
    table: "cms_faq_items",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["question", "answer", "category"],
    hasUpdatedAt: true,
    columns: [
      { model: "question", col: "question" },
      { model: "answer", col: "answer" },
      { model: "category", col: "category" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  contact: {
    table: "cms_contact_messages",
    orderBy: { col: "created_at", ascending: false },
    searchable: ["name", "email", "subject"],
    hasUpdatedAt: false,
    columns: [
      { model: "name", col: "name" },
      { model: "email", col: "email" },
      { model: "subject", col: "subject" },
      { model: "message", col: "message" },
      { model: "status", col: "status" },
      { model: "createdAt", col: "created_at", readOnly: true },
    ],
  },
  "feature-requests": {
    table: "cms_feature_requests",
    orderBy: { col: "created_at", ascending: false },
    searchable: ["title", "requester", "email"],
    hasUpdatedAt: false,
    columns: [
      { model: "title", col: "title" },
      { model: "description", col: "description" },
      { model: "requester", col: "requester" },
      { model: "email", col: "email" },
      { model: "votes", col: "votes", number: true },
      { model: "status", col: "status" },
      { model: "createdAt", col: "created_at", readOnly: true },
    ],
  },
  "bug-reports": {
    table: "cms_bug_reports",
    orderBy: { col: "created_at", ascending: false },
    searchable: ["title", "reporter", "email"],
    hasUpdatedAt: false,
    columns: [
      { model: "title", col: "title" },
      { model: "description", col: "description" },
      { model: "reporter", col: "reporter" },
      { model: "email", col: "email" },
      { model: "severity", col: "severity" },
      { model: "status", col: "status" },
      { model: "url", col: "url" },
      { model: "createdAt", col: "created_at", readOnly: true },
    ],
  },
  media: {
    table: "cms_media_assets",
    orderBy: { col: "uploaded_at", ascending: false },
    searchable: ["name"],
    hasUpdatedAt: false,
    columns: [
      { model: "name", col: "name" },
      { model: "type", col: "type" },
      { model: "url", col: "url" },
      { model: "sizeKb", col: "size_kb", number: true },
      { model: "width", col: "width", number: true },
      { model: "height", col: "height", number: true },
      { model: "uploadedBy", col: "uploaded_by" },
      { model: "uploadedAt", col: "uploaded_at", readOnly: true },
    ],
  },
  stats: {
    table: "cms_stats",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["label", "value"],
    hasUpdatedAt: true,
    columns: [
      { model: "value", col: "value" },
      { model: "label", col: "label" },
      { model: "group", col: "group_name" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  steps: {
    table: "cms_steps",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["title", "body"],
    hasUpdatedAt: true,
    columns: [
      { model: "step", col: "step" },
      { model: "title", col: "title" },
      { model: "body", col: "body" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  testimonials: {
    table: "cms_testimonials",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["name", "role", "quote"],
    hasUpdatedAt: true,
    columns: [
      { model: "quote", col: "quote" },
      { model: "name", col: "name" },
      { model: "role", col: "role" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  principles: {
    table: "cms_principles",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["title", "body"],
    hasUpdatedAt: true,
    columns: [
      { model: "title", col: "title" },
      { model: "body", col: "body" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  pillars: {
    table: "cms_pillars",
    orderBy: { col: "sort_order", ascending: true },
    searchable: ["label", "title", "body"],
    hasUpdatedAt: true,
    columns: [
      { model: "label", col: "label" },
      { model: "title", col: "title" },
      { model: "body", col: "body" },
      { model: "points", col: "points", json: true },
      { model: "image", col: "image" },
      { model: "url", col: "url" },
      { model: "order", col: "sort_order", number: true },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
  "about-story": {
    table: "cms_about_story",
    orderBy: { col: "updated_at", ascending: false },
    searchable: ["body"],
    hasUpdatedAt: true,
    columns: [
      { model: "body", col: "body" },
      { model: "status", col: "status" },
      { model: "updatedAt", col: "updated_at", readOnly: true },
    ],
  },
}

export function getCmsResource(resource: string): CmsResourceConfig | null {
  return CMS_RESOURCES[resource] ?? null
}

/** Comma-separated select list including the id column. */
export function cmsSelectColumns(config: CmsResourceConfig): string {
  return ["id", ...config.columns.map((c) => c.col)].join(", ")
}

/** Convert a DB row into the camelCase client model. */
export function cmsRowToModel(config: CmsResourceConfig, row: CmsRow): CmsModel {
  const model: CmsModel = { id: row.id }
  for (const c of config.columns) {
    let value = row[c.col]
    if (c.json) {
      value = Array.isArray(value) ? value : value == null ? [] : value
    } else if (c.number) {
      value = value == null ? 0 : Number(value)
    } else if (c.boolean) {
      value = Boolean(value)
    }
    model[c.model] = value ?? (c.json ? [] : c.number ? 0 : c.boolean ? false : "")
  }
  return model
}

/**
 * Convert a partial client model into a DB row for insert/update.
 * Skips read-only columns and any keys not present in the input.
 * Stamps updated_at when the table supports it.
 */
export function cmsModelToRow(
  config: CmsResourceConfig,
  model: Partial<CmsModel>,
  { isCreate }: { isCreate: boolean },
): CmsRow {
  const row: CmsRow = {}
  for (const c of config.columns) {
    if (c.readOnly) continue
    if (!(c.model in model)) continue
    let value = model[c.model]
    if (c.number) value = value == null || value === "" ? 0 : Number(value)
    if (c.boolean) value = Boolean(value)
    row[c.col] = value
  }
  if (config.hasUpdatedAt) {
    row.updated_at = new Date().toISOString()
  }
  void isCreate
  return row
}
