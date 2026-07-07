# Solura Command Center — single-page Notion business overview

## Context / motivation

Solura has grown past the point where its two founders can hold the whole
business in their heads: multiple internal products at different stages,
a growing list of paid tools, and — newly urgent — Uzbekistan tax/legal
obligations with real deadlines. There is currently no single place that
shows all of it; the closest things that exist are a one-time April 20
progress report and a handful of per-project Airtable/Supabase tables that
each only cover one product.

This spec covers a single Notion page, shared between the two founders,
that lays the whole business out at a glance: what we're building, what
it costs us, and what we legally owe — inspired directly by "whole business
on one page" Notion setups.

**Out of scope:** client website deliverables (aa clinica, begizoda dental,
etc. — these are finished one-off builds, not ongoing pipeline), and IG
Check / YouTube Kids Automation (deprioritized for now, can be added back
as products later without changing the schema).

## Page structure

One Notion page, **"Solura Command Center"**, containing:

1. An "⚠️ This Week" callout (manually curated, see below)
2. Three databases, each rendered as an inline table view on the page

### Why one connected page (not separate linked pages)

The whole point is glanceability — the founders open one page and see
everything, rather than clicking into three separate database pages. The
tradeoff is that Subscriptions relate to Products via a relation property
rather than being duplicated per product.

## Database 1 — Products & Pipeline

Table view, grouped by **Stage**.

| Property | Type | Values / notes |
|---|---|---|
| Name | Title | |
| Stage | Select | Idea, Pilot, Building, Live-Private, Live-Public, Paused, Shelved |
| Status | Select | On track (green), At risk (yellow), Blocked (red) |
| Revenue | Number ($) | Mostly 0 today — field exists for when this changes |
| Next Milestone | Text | |
| Current Blocker | Text | |
| Subscriptions Used | Relation → Subscriptions & Costs | |

Initial rows:

| Name | Stage | Status | Revenue | Next Milestone | Current Blocker |
|---|---|---|---|---|---|
| Tender Agent | Live-Private (→ going public) | On track | $0 | Public/multi-tenant launch, same playbook as Cortège | — |
| Lead Generation | Pilot | On track | $0 | Scale past the 66-lead Newark test batch | — |
| Kim Kim | Live-Private | On track | $0 | — | — |
| CRM bot | Shelved | Blocked | $0 | — | Built on n8n, which is no longer used |
| Cortège | Pilot | On track | $0 | Public multi-tenant SaaS launch (currently piloting with one real venue) | Waiting on Instagram Meta App Review + real data from venue owner |

## Database 2 — Subscriptions & Costs

Table view, grouped by **Status**.

| Property | Type | Values / notes |
|---|---|---|
| Name | Title | |
| Type | Select | Fixed subscription, Usage-based |
| Status | Select | Active-paid (green), Active-free-tier (blue), Not used (grey) |
| Cost | Number ($) | Notion shows an automatic Sum at the bottom of this column — that's the running "monthly burn" total, no extra setup |
| Cadence | Select | Monthly, Annual, Occasional/usage |
| Renewal Date | Date | |
| Used By | Relation → Products & Pipeline | Left empty + tagged "Shared/company-wide" for Railway, Supabase, Claude Code, Google Workspace, domain |
| Notes | Text | |

Initial rows:

| Name | Type | Status | Cost | Cadence | Renewal | Used by |
|---|---|---|---|---|---|---|
| Claude Code | Fixed | Active-paid | $22.40 (→ upgrading to Max) | Monthly | 2026-07-16 | Company-wide |
| CloudTalk (Starter) | Fixed | Active-paid | $34 + $10 prepaid credit | Monthly | — | Lead Generation |
| Google Workspace | Fixed | Active-paid | $7 | Monthly (assumed — confirm) | 2026-07-17 | Company-wide |
| Domain | Fixed | Active-paid | ~$12 | Annual | 2027-07-04 | Company-wide |
| Instagram verification | Fixed | Active-paid | $7.99 | Monthly | 2026-07-13 | Cortège |
| Railway | Fixed | Active-paid | $5 | Monthly | 2026-07-25 | Shared (Tender Agent, Lead Generation, Cortège) |
| Apify | Usage-based | Active-paid | $5 | Monthly | 2026-07-17 | Lead Generation |
| Nano Banana 2 + Kling | Usage-based | Active-paid | ~$5-7 | Occasional | — | Cortège (design/marketing use) |
| OpenAI tokens | Usage-based | Active-paid | ~$5 (→ $10-15 as usage grows) | Usage-based | — | Tender Agent, Kim Kim, Cortège |
| Vercel | Fixed | Active-free-tier | $0 | — | — | Shared |
| Supabase | Fixed | Active-free-tier | $0 | — | — | Shared (Tender Agent, Lead Generation, Cortège) |
| Firecrawl | Usage-based | Active-free-tier | $0 | — | — | Tender Agent |
| Tavily | Usage-based | Active-free-tier | $0 | — | — | Kim Kim |
| n8n | Fixed | Not used | $0 | — | — | — |
| Airtable | Fixed | Not used | $0 | — | — | — |

(ElevenLabs dropped entirely per owner — not listed at all.)

**Open item to confirm:** domain cost was given as "~$12/year, if I'm not
mistaken" — worth checking the actual receipt.

**Open item, not a blocker:** owner is considering migrating these accounts
off a personal Google account onto a company one — noted here as a future
task, not reflected in the schema.

## Database 3 — Legal & Compliance (Uzbekistan Ops)

Table view, sorted by **Due Date** ascending.

| Property | Type | Values / notes |
|---|---|---|
| Task | Title | |
| Type | Select | Recurring, One-time |
| Frequency | Select | Monthly, Annual, One-time (only meaningful if Type = Recurring) |
| Due Date | Date | |
| Cost | Number ($) | Optional |
| Status | Select | Not started, In progress, Done |
| Notes | Text | |

Initial rows:

| Task | Type | Frequency | Due Date | Cost | Status | Notes |
|---|---|---|---|---|---|---|
| World First payment verification | One-time | — | ~2026-07-12 | — | In progress | Blocks receiving client payments internationally |
| Бухгалтерский отчёт в налоговую | Recurring | Monthly | 2026-07-14 | $25 | Not started | |
| IT Park application | One-time | — | This week | — | Not started | If approved: no turnover tax, only 7.5% payroll tax instead of current regime |
| Трудовой договор (Директор) | One-time | — | — | — | Not started | |
| Mymehnat регистрация (0.5 ставки) | One-time | — | — | — | Not started | |
| Зарплата директору | Recurring | Monthly | — | — | Not started | |
| Налог на аренду помещения | Recurring | Monthly | — | — | Not started | Tied to lease |
| Договор аренды | One-time | — | — | — | Not started | Reference document |

## "⚠️ This Week" callout

A manually-maintained callout block at the top of the page (not a live
formula — Notion's API doesn't support merging two databases into one
auto-sorted feed). Initial content, nearest-deadline first:

- World First verification (blocks client payments) — ~5 days
- Бухгалтерский отчёт в налоговую — due Jul 14, $25
- IT Park application — due this week
- Instagram verification renews — Jul 13
- Claude Code renews — Jul 16

The founders re-skim the two sorted tables periodically and refresh this
block by hand — cheap to maintain, honest about what Notion can actually
automate.

## Visual treatment

Best-effort, built via whatever the Notion MCP server's tools actually
expose once connected (page icon/cover, callout blocks with emoji,
dividers, colored Select options for Status/Stage). Chart/graph views on
databases are a Notion-client feature that the public Notion API has
historically not exposed for creation — if the connected MCP server
doesn't support it, those get added manually in the Notion app after the
databases/data are built, rather than promised and not delivered.

## Build mechanism & sequencing

1. Notion MCP server (`@notionhq/notion-mcp-server`) is configured in
   `.mcp.json` with a real integration token — requires a Claude Code
   restart to load, and the target Notion page/workspace must be shared
   with the integration before any MCP tool call will see it.
2. Once live: create the page, then the three databases with the schemas
   above, then populate the initial rows, then wire the Products ↔
   Subscriptions relations, then add the callout and any icon/cover/color
   polish the available tools support.
3. Ongoing ownership: both founders update rows directly in Notion as
   status/stage/cost/deadlines change — this is a living page, not a
   one-time export.
