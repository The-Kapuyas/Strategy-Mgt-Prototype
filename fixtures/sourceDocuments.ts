import { SourceDocument } from '../types/checkin';

export const SOURCE_DOCUMENTS: Record<string, SourceDocument> = {
  'SD-001': {
    id: 'SD-001',
    type: 'linear_update',
    title: 'ENG-342: Data Platform Schema Migration — Sprint Update',
    author: 'Andrew Chen',
    authorRole: 'Data Engineer, P7 Lead',
    date: '2026-02-26',
    url: 'linear://novacraft/issue/ENG-342',
    summary: 'Schema migration blocked by foreign key constraints on 14 downstream tables. Timeline extended by 3 weeks to ~March 18.',
    content: `## ENG-342: Data Platform Schema Migration

**Status:** In Progress · **Priority:** Urgent · **Sprint:** Sprint 12
**Assignee:** Andrew Chen · **Labels:** backend, migration, P7

---

### Update — Feb 26, 2026

The schema migration has hit a significant complication. The legacy \`event_log\` table has foreign key constraints on **14 downstream tables**, which means we cannot perform a zero-downtime migration as originally planned.

**What we tried:**
- Online schema change via \`pt-online-schema-change\` — failed because the trigger-based approach conflicts with our replication setup
- Shadow table approach — works for the core table but doesn't handle the FK cascade across dependent tables
- We considered dropping FKs temporarily, but 6 of the 14 tables have application-level code that relies on FK enforcement for data integrity

**Revised plan:**
We're now going with a phased migration: migrate the 14 dependent tables first (2 per day over the next week), then migrate \`event_log\` last with a 30-minute maintenance window. This adds approximately **3 weeks** to the original timeline.

**New estimated completion:** ~March 18, 2026 (was February 28)

**Impact on P5:** This directly blocks the AI Workflow Engine's inference pipeline. The ML models query \`event_log\` for feature vectors, and they need the new schema's indexed columns to hit the 200ms latency target. @Samantha Lee and @Carlos Mendez are aware.

**Impact on P25:** Carlos had planned to start the model retraining pipeline integration this sprint, but he's been pulled into helping debug the FK dependency map. No progress on P25 this sprint.

---

_Andrew Chen · Feb 26, 2026 at 3:42 PM_`,
    relatedItemIds: ['P7', 'P5', 'P25', 'KR2.1'],
  },

  'SD-002': {
    id: 'SD-002',
    type: 'notion_doc',
    title: 'P5 Sprint Retro — Feb 25: Latency Investigation Results',
    author: 'Samantha Lee',
    authorRole: 'Senior ML Engineer, P5 Lead',
    date: '2026-02-25',
    url: 'notion://novacraft/eng/p5-sprint-retro-feb25',
    summary: 'Root cause identified: synchronous reads against P7 legacy schema add ~600ms. Temp caching brings p50 to 350ms but p99 stays at 1.2s.',
    content: `## P5 Sprint Retro — February 25, 2026

**Sprint:** 11 · **Team:** Samantha Lee, Carlos Mendez, Ryan Nguyen, Amanda Clark

---

### Latency Investigation — Root Cause Found

We've identified the root cause of the 800ms ML inference latency that's been blocking GA readiness.

**The problem:** Our feature store performs **synchronous reads** against P7's legacy \`event_log\` schema. Each inference request triggers 3–5 feature lookups, and each lookup averages 120–180ms against the un-indexed legacy columns. Total: ~600ms just for feature retrieval.

**With the new P7 schema:** Andrew Chen's team has benchmarked the new indexed columns at **8–12ms per lookup**, which would bring total feature retrieval to ~50ms. This alone drops end-to-end inference from 800ms to ~250ms.

**Temporary mitigation deployed:** We implemented a hot feature vector cache (Redis-backed) that pre-computes the most common feature combinations:
- **p50 latency:** 800ms → **350ms** ✓
- **p95 latency:** 1.1s → **680ms**
- **p99 latency:** 1.4s → **1.2s** ✗ (still unacceptable for GA)

The cache hit rate is only ~60% because workflow patterns are highly variable. We cannot cache our way to the 200ms target — we need the schema migration.

### Resource Situation

Carlos Mendez spent **~60% of this sprint** on P5 latency debugging, which means **P25 (AI Model Training Pipeline) got zero progress** this sprint. Carlos is also nominally on P7, P11, and P14 but has contributed almost nothing to those projects in the past 3 weeks. He's stretched across 5 projects at 120% utilization and it shows — his commit velocity on P5 is down 40% from Sprint 9.

Ryan Nguyen picked up the caching implementation and did excellent work. Amanda Clark is splitting 40/60 between P5 and P6, which is manageable — Tyler (P6 lead) confirmed this works for them.

### Action Items

1. ~~Implement hot feature vector cache~~ ✓ Done
2. **Wait for P7 schema migration** (~March 18 per Andrew's latest estimate)
3. Integrate new schema + validate latency targets (2–3 weeks after P7 completes)
4. **Escalate Carlos reallocation** — recommend pulling him from P11 and P14 immediately

### Sprint Verdict

🔴 **P5 is At Risk.** We cannot hit the 200ms latency target until P7's migration completes. Estimated date for P5 to deliver a GA-quality stable build: **mid-April at earliest.**

---

_Samantha Lee · Feb 25, 2026_`,
    relatedItemIds: ['P5', 'P7', 'P25', 'KR2.1'],
  },

  'SD-003': {
    id: 'SD-003',
    type: 'email',
    title: 'Re: P5 Latency Impact on KR2.1 Timeline',
    author: 'Marcus Thompson',
    authorRole: 'VP Engineering',
    date: '2026-02-27',
    url: 'email://novacraft/thread/p5-latency-kr21',
    summary: 'VP Eng recommends slipping P8 to April 15 and reallocating Carlos from P11/P14. VP Product asks about a "lite beta" option.',
    content: `## Email Thread: P5 Latency Impact on KR2.1 Timeline

---

**From:** Marcus Thompson <marcus@novacraft.io>
**To:** David Park <david@novacraft.io>
**CC:** Elena Rodriguez <elena@novacraft.io>
**Date:** February 27, 2026 at 9:15 AM
**Subject:** Re: P5 Latency Impact on KR2.1 Timeline

David,

Following up on our sync yesterday. I've reviewed the sprint retros from Samantha's team and Andrew's migration update. Here's where we stand:

**Timeline reality:**
1. P7 schema migration now estimated to complete **~March 18** (was Feb 28). Andrew's team hit FK constraint issues on 14 downstream tables.
2. After P7 completes, P5 needs **2–3 weeks** to integrate the new schema and validate that inference latency drops below 200ms.
3. That puts a stable P5 build at **mid-April** at earliest.

**My recommendation:**
- **Slip P8 (AI Beta Program) start from March 1 → April 15.** There's no point launching a beta with 800ms response times. Even the cached version at 350ms p50 / 1.2s p99 isn't good enough for customers to evaluate meaningfully.
- **Reallocate Carlos Mendez.** He's at 120% across 5 projects and it's hurting everyone. I want to pull him from P11 (Security Compliance Tooling) and P14 (SDK & Developer Tools) so he can focus on P5 and P25. Sarah Chen is at 20% utilization with 0 active projects — she has the engineering skills for P14.

I'll be proposing both of these at the March 2 check-in. Wanted to give you a heads-up since P8 is yours.

— Marcus

---

**From:** David Park <david@novacraft.io>
**To:** Marcus Thompson <marcus@novacraft.io>
**Date:** February 27, 2026 at 11:30 AM
**Subject:** Re: P5 Latency Impact on KR2.1 Timeline

Marcus,

Thanks for the transparency. The April 15 slip is painful but I understand the rationale.

One thing I want to explore: **could we do a "lite beta" with the 3 workflow templates that already work at acceptable latency?** My team has identified that the document processing, email routing, and form automation workflows all stay under 300ms because they don't hit the event_log-heavy inference path. That's ~40% of the planned beta feature set.

The advantage: we start collecting customer feedback 4–6 weeks earlier. Beta NPS will be lower (narrower feature set), but we learn what matters to customers before the full launch. This could actually de-risk KR2.2.

The disadvantage: customers see an incomplete product. If they judge harshly, it could poison the well for the full launch.

Worth discussing at the check-in?

— David

---

**From:** Marcus Thompson <marcus@novacraft.io>
**To:** David Park <david@novacraft.io>
**Date:** February 27, 2026 at 2:10 PM
**Subject:** Re: P5 Latency Impact on KR2.1 Timeline

Interesting idea. Let me check with Samantha whether the lite workflows are truly stable in isolation or if they share any codepaths with the latency-affected inference pipeline.

One concern: the lite beta still needs the P6 UI to be functional. Tyler's team is at 35% and on track, but the drag-and-drop canvas shipped last sprint — the property panel and validation layer aren't there yet. A beta without the builder UI would just be API-only, which limits the customer pool.

Let's bring both options to the check-in: full slip to April 15 vs. lite beta March 15.

— Marcus`,
    relatedItemIds: ['P5', 'P7', 'P8', 'KR2.1', 'KR2.2'],
  },

  'SD-004': {
    id: 'SD-004',
    type: 'linear_update',
    title: 'ENG-298: Workflow Builder UI — Sprint 8 Summary',
    author: 'Tyler Jackson',
    authorRole: 'Frontend Engineer, P6 Lead',
    date: '2026-02-28',
    url: 'linear://novacraft/project/ENG-298',
    summary: 'P6 at 35% and on track. Sprint 8 delivered drag-and-drop canvas and component palette. No dependency on P5 ML inference.',
    content: `## ENG-298: Workflow Builder UI — Sprint 8 Summary

**Status:** In Progress · **Priority:** High · **Sprint:** 8 of 22
**Assignee:** Tyler Jackson · **Labels:** frontend, react, P6

---

### Sprint 8 Deliverables ✓

**Completed this sprint:**
- ✅ Drag-and-drop workflow canvas with snap-to-grid
- ✅ Component palette (12 node types: trigger, action, condition, loop, delay, webhook, email, form, API call, transform, filter, merge)
- ✅ Real-time preview panel (renders workflow execution simulation)
- ✅ Canvas zoom/pan controls with minimap
- ✅ Lisa Chen completed the responsive dashboard layout for the workflow management page

**Sprint velocity:** 34 points (target: 30) — the team is running slightly hot which is sustainable.

### Sprint 9 Plan

**Upcoming work:**
- Property panel for selected nodes (each of the 12 node types needs a custom config form)
- Workflow validation layer (detect cycles, orphaned nodes, missing required fields)
- Start on the test/debug mode that lets users step through workflow execution

### Team & Resource Notes

Amanda Clark is splitting time 40% P5 / 60% P6. This has been working fine — her P5 work is on the inference API layer and her P6 work is on the canvas rendering, so there's minimal context-switching cost. Tyler confirmed this allocation is sustainable.

### Independence from P5

**Important note for planning:** P6 has **no dependency on P5's ML inference pipeline.** The Workflow Builder UI connects to the engine via a well-defined API contract. During development, we're using stub data and mock responses. The UI will work identically whether the backend returns results in 50ms or 800ms — that's a P5 problem, not a P6 problem.

The only hard dependency is that P6 needs the API contract to be stable, which it has been since Sprint 5. If P5 changes the API shape, we need ~1 sprint to adapt, but there's no indication that's happening.

### Timeline

On track for **August 15** completion. Current progress: **35%**. No blockers, no risks.

---

_Tyler Jackson · Feb 28, 2026 at 5:15 PM_`,
    relatedItemIds: ['P6', 'KR2.1'],
  },

  'SD-005': {
    id: 'SD-005',
    type: 'slack_message',
    title: '#eng-leads: Carlos workload discussion',
    author: 'Samantha Lee',
    authorRole: 'Senior ML Engineer, P5 Lead',
    date: '2026-02-24',
    url: 'slack://novacraft/C04ENGLD/p1708790400',
    summary: 'Team flags Carlos at 120% across 5 projects. Sarah Chen suggested as P14 backfill. Carlos agrees P11/P14 can be delegated.',
    content: `## #eng-leads — Thread: Carlos workload

---

**Samantha Lee** · 10:32 AM
Hey team — I need to flag something. Carlos has been context-switching across 5 projects and his output on P5 has dropped significantly. In Sprint 11, he spent ~60% of his time on P5 latency debugging, which is the right priority, but it means P25 got zero progress and I know he's supposed to be contributing to P7, P11, and P14 as well. His commit velocity on P5 is down 40% from Sprint 9. This isn't sustainable.

**Andrew Chen** · 10:45 AM
Agreed from the P7 side. Carlos was supposed to help with the data pipeline optimization for the new schema, but he's only been available ~2 hours/week for the past 3 sprints. I've been covering his tasks but it's slowing down the migration. Honestly, if he could focus on just P5 and P25 that would be the highest-impact allocation.

**Ryan Nguyen** · 10:52 AM
+1. I've been pair-programming with Carlos on the caching layer and when he's focused, he's incredibly productive. But he comes into our standups having just context-switched from P11 security tooling and it takes him 30 min to ramp back in every time.

**Tyler Jackson** · 11:03 AM
From the P6 side, we don't need Carlos at all — Amanda Clark is our bridge to P5 and that's working well. Just wanted to confirm he's not on our critical path.

**Ryan Nguyen** · 11:08 AM
What about Sarah Chen for P14? She's at like 20% utilization right now and her background is in SDK development — she literally built the SDK at her last company.

**Marcus Thompson** · 11:22 AM
Thanks for raising this, Samantha. I'm going to propose a reallocation at the next check-in. Pull Carlos from P11 and P14, backfill P14 with Sarah. Let me work through the details but consider this acknowledged at the leadership level.

**Carlos Mendez** · 11:45 AM
I appreciate everyone flagging this. Honestly, I've been burning the candle at both ends and the quality of my work is suffering across the board. I'm fully on board with focusing on P5 and P25 — those are the two projects where my ML expertise actually matters. P11 and P14 are both areas where other engineers can be just as effective. Happy to do a knowledge transfer on the P14 SDK architecture with Sarah if that helps.

**Samantha Lee** · 11:50 AM
Thanks Carlos. @Marcus Thompson — can we get this into the March 2 check-in as a formal proposal? I don't want to wait another 2 weeks for relief.

**Marcus Thompson** · 11:55 AM
Already on it. 👍

---

_#eng-leads · Feb 24, 2026_`,
    relatedItemIds: ['P5', 'P7', 'P11', 'P14', 'P25'],
  },
};
