# Leadership Check-in Scenario — Novacraft, March 2 2026

## Context

It's February 28, 2026 — two days before the bi-weekly leadership check-in. Each leader gets a notification: "Check-in prep is open. Review your items and submit updates by March 1."

**The central tension:** The AI Workflow Engine (P5) hit latency issues → cascades into the AI Beta Program (P8) not starting on time → threatens the entire Product objective (O2). This is compounded by engineering hiring being behind (only 2 of 14 hired) and Carlos Mendez burning out across 5 projects.

**5 decisions the check-in needs to make:**
1. Slip P8 start date by 6 weeks
2. Reallocate Carlos (pull from 2 projects, backfill with underutilized Sarah Chen)
3. Increase ML salary band by 15% ($200K budget hit)
4. Handle SOC 2 auditor scheduling conflict
5. Accelerate the onboarding redesign (good news — ship 30 days early)

---

## The Leader Update Experience (General)

Each leader opens the tool and sees a filtered view of only items they own. The experience has 3 sections per item:

1. **AI-prefilled status** — The AI looks at timeline position, progress %, resource data, and dependencies to suggest a status. The leader confirms or corrects.
2. **Narrative fields** — Free-text fields for: what changed, risks/blockers, what's next.
3. **Propose a change** (optional) — If something needs to change in the plan (dates, resources, scope), the leader can draft a proposal. This becomes a decision card in the facilitator's brief.

---

## VP Engineering — The Complex Update

**Owns:** O3 (Build scalable team and platform), KR2.4 (API latency), KR2.5 (SOC 2), KR3.2 (Uptime), KR3.3 (Tech debt)
**Projects under their reports:** P5, P6, P7, P11, P12, P13, P14, P20, P21, P22, P23, P25, P26 (13 projects)

### What the AI pre-fills:

The AI scans all 13 projects and flags the ones that need attention. Most projects are proceeding normally — the AI doesn't bother the VP with those. Instead it surfaces 4 items:

**Item 1: P5 (AI Workflow Engine) — AI suggests: At Risk**
> *"P5 is 45% complete with 5 months remaining, but it depends on P7 (Data Platform) which is only 50% done. Carlos Mendez is on this project at 120% total utilization across 5 projects. I've marked this At Risk."*

The VP confirms "At Risk" and adds narrative:
- **What changed:** "Hit ML inference latency issues — 800ms response times vs. 200ms target. Root cause is the P7 schema migration."
- **Risk:** "If latency isn't resolved by mid-April, the AI Beta Program (P8) can't launch on schedule."

Then the VP clicks **"Propose a Change"** and fills in:
- **What to change:** P8 start date, from March 1 → April 15
- **Why:** "P5 can't deliver a stable build until data platform migration completes. Andrew Chen estimates 3 more weeks."
- **Who else is affected:** Tags VP Product (David Park owns P8)

**Item 2: Carlos Mendez overallocation — AI suggests: Escalation**
> *"Carlos Mendez is assigned to 5 projects (P5, P7, P11, P14, P25) at 120% utilization. This is the highest overallocation on the team. Sarah Chen is at 20% utilization with 0 active projects."*

The VP clicks **"Propose a Change"**:
- **What to change:** Remove Carlos from P11 and P14. Add Sarah Chen to P14.
- **Why:** "Carlos needs to focus on P5 and P25 — the two critical ML projects. Sarah has relevant engineering skills for P14 (SDK development)."

**Item 3: P12 (SOC 2) — AI suggests: At Risk**
> *"P12 is 40% complete with target date July 15. Progress is on track, but I noticed no auditor milestone is scheduled."*

The VP corrects the AI — the project itself is on-track, but there's an external dependency:
- **Status:** In Progress (keeps the AI suggestion but overrides severity)
- **Risk:** "External auditor (Big4) has a scheduling conflict. June audit window no longer available. Next window is August."

Clicks **"Propose a Change"**:
- **What to change:** KR2.5 target date, July 31 → August 31
- **Why:** "Switching auditors mid-process would add 2-3 months. Accepting the August window is faster."

**Item 4: The other 10 projects — AI suggests: On Track**
> *"P6 (35%), P7 (50%), P11 (15→22%), P13 (25%), P20 (65%), P21 (planning), P22 (12%), P23 (8%), P25 (30%), P26 (planning) — all progressing within expected range. No issues detected."*

The VP scans the list, sees nothing surprising, and confirms all with one click ("Confirm all on-track items"). No narrative needed for routine updates.

**Time spent: ~8 minutes** (vs. 30+ minutes writing a status doc from scratch)

---

## VP Sales — The Clean Update

**Owns:** O1 (Scale ARR), KR1.1 (20 enterprise deals), KR1.2 (Reduce sales cycle)
**Projects:** P1 (Sales Playbook), P2 (Demo Portal), P3 (Sales Cycle Optimization)

### What the AI pre-fills:

**KR1.1 — AI suggests: On Track**
> *"3 deals closed out of 20 target (15% at month 2 of 12). Linear pace would suggest ~3.3 by now. On track."*

VP Sales corrects the metric: **current: 3 → 4** ("Closed FinServ deal this week, $140K ACV"). Confirms On Track.

**KR1.2 — AI suggests: At Risk**
> *"Sales cycle at 72 days vs. 55-day target. Only 10-day improvement in 2 months. At this rate, you'll reach ~60 days by September, missing the target."*

VP Sales overrides to On Track with note: "The 72-day number is skewed by two legacy deals in the pipeline. New deals using the updated playbook are averaging 58 days. Expect the metric to improve as legacy deals close out."

**P1 (Enterprise Sales Playbook) — AI suggests: On Track**
> *"75% complete, end date March 31. On pace."*

VP Sales updates: progress 75% → 82%. Adds: "Playbook complete, training sessions start next week."

**P3 (Sales Cycle Optimization) — AI suggests: Just Started**
> *"Start date was March 1. Marking as kicked off."*

Confirms. No risks.

**No proposed changes.** VP Sales is in good shape.

**Time spent: ~3 minutes**

---

## VP Product — The Dependent Update

**Owns:** O2 (Launch AI features), KR2.1 (AI GA), KR2.2 (100 beta customers), KR2.3 (NPS), KR2.6 (Public API)
**Projects:** P8 (AI Beta), P9 (Docs Hub), P10 (NPS Program), P15 (Integration Marketplace)

### What the AI pre-fills:

**KR2.1 (Ship AI to GA) — AI suggests: At Risk**
> *"This KR depends on P5 (AI Workflow Engine) which is At Risk, and P6 (Workflow Builder UI) at 35%. Target date June 30 is tight."*

VP Product confirms At Risk. Notes: "Aligned with VP Eng on the latency issue. P6 is on track independently — the risk is entirely from P5."

**P8 (AI Beta Program) — AI suggests: Blocked**
> *"P8 was scheduled to start March 1 but depends on P5 delivering a stable build. P5 is At Risk. I've marked P8 as Blocked."*

VP Product confirms Blocked. Adds: "Agreed with VP Eng to slip to April 15. Using the extra time to recruit more beta candidates — currently have 28 interested companies."

**Also flags a forward-looking risk:**
- **Risk on KR2.2:** "If P5 slips beyond April 15, the 100-customer target becomes unachievable. We'd need to either (a) reduce the target to 60 or (b) extend the deadline to Q4."

This is an **FYI for the CEO** — not a proposal yet, but an early warning the facilitator should know about.

**P10 (Enterprise NPS) — AI suggests: On Track**
> *"NPS at 36, up from 32 baseline. Target 50. Progress is gradual but trending right."*

VP Product adds: "Latest survey came back at 38 (up from 36). Top 3 detractor themes: onboarding complexity, missing API docs, slow support response."

**No proposed changes from VP Product** — but they co-sign VP Eng's P8 slip proposal.

**Time spent: ~5 minutes**

---

## VP People — The Budget Request

**Owns:** KR3.1 (Grow eng team to 32), KR3.4 (Employee engagement)
**Projects:** P18 (Eng Hiring Sprint), P19 (GTM Expansion), P24 (Engagement Program)

### What the AI pre-fills:

**KR3.1 (Grow eng team) — AI suggests: At Risk**
> *"2 of 14 target engineers hired (14%). At month 6 of 13-month timeline. Significantly behind linear pace (should be ~6 hires by now)."*

VP People confirms At Risk. This is the one that needs a proposal.

**P18 (Eng Hiring Sprint) — AI suggests: At Risk**
> *"14% progress, target Sept 30. 3 offers out, 2 in final rounds, but lost 2 candidates recently."*

VP People adds narrative:
- **What changed:** "Lost 2 ML specialist candidates to Google and Meta in the last 3 weeks. Both cited compensation as the deciding factor."
- **Risk:** "Current salary band ($180K-$220K) is below market 50th percentile for ML engineers. Will keep losing candidates without adjustment."

Clicks **"Propose a Change"**:
- **What to change:** ML engineer salary band from $180K-$220K → $210K-$260K
- **Budget impact:** ~$200K additional annual spend for 5 ML hires
- **Why:** "Aligns with 75th percentile comp data. 3 offers are out now — the higher band could close them. Without this, P5 and P25 timelines extend further."
- **Tags:** CEO (budget approval needed)

**P24, P19 — AI suggests: On Track**

Confirmed quickly.

**Time spent: ~5 minutes**

---

## VP Customer Success — The Good News Update

**Owns:** Projects under O2 for customer-facing delivery
**Projects:** P16 (Customer Health Dashboard), P17 (Enterprise Onboarding Redesign)

### What the AI pre-fills:

**P17 (Onboarding Redesign) — AI suggests: Ahead of Schedule**
> *"68% complete with end date April 30. At this velocity, likely to complete by late March."*

VP CS confirms and adds the story:
- **What changed:** "New onboarding flow is in pilot with 3 enterprise customers. Early results are exceptional — time-to-value reduced from 6 weeks to 3.5 weeks. All 3 gave positive feedback."

Clicks **"Propose a Change"**:
- **What to change:** P17 end date April 30 → March 31. Status → Completed.
- **Why:** "Implementation is stable, ready for GA. Shipping early means beta customers (KR2.2) benefit from improved onboarding from day one."

**P16 (Customer Health Dashboard) — AI suggests: On Track (slow start)**
> *"8% progress, end date August 31. Just getting started but within expected range."*

Confirmed. No issues.

**Time spent: ~3 minutes**

---

## What the AI Does After All Updates Are In

Once all leaders submit (Feb 28–March 1), the AI synthesizes everything into the **Check-in Brief** that the CEO/facilitator sees on March 2:

1. **Identifies the cascade:** VP Eng flagged P5 latency → VP Product confirmed P8 blocked → AI connects to KR2.2 → rolls up to O2. This becomes the "Top Story" cascade alert.
2. **Consolidates proposals:** VP Eng proposed P8 slip + Carlos reallocation + SOC 2 slip. VP People proposed salary band increase. VP CS proposed acceleration. AI packages these as 5 decision cards.
3. **Cross-references co-signatures:** VP Product co-signed the P8 slip. AI notes "proposed by VP Engineering, supported by VP Product" on that card.
4. **Filters out noise:** 15+ projects were confirmed on-track. These don't appear in the brief at all. The CEO only sees what needs attention.
5. **Generates the impact analysis:** For each proposal, the AI calculates downstream effects by traversing dependencies and resource allocations.
6. **Highlights the early warning:** VP Product's note about KR2.2 becoming unachievable if P5 slips further gets surfaced as an FYI note attached to Decision 1.

---

## Friction Points (Realistic Complexity)

**Competing proposals** — VP Eng says slip P8 to April 15 (wait for full engine). VP Product says March 15 (ship a lite beta now). The facilitator has to resolve a genuine disagreement, not rubber-stamp.

**Cross-team blindspots** — VP Eng proposes pulling Carlos off P11 without consulting VP Product, who owns the KR that P11 serves. AI auto-tags VP Product, who responds with a conditional: "fine, but commit that KR2.4 doesn't slip."

**Data vs. judgment** — VP Sales overrides the AI's At Risk flag on KR1.2 with qualitative context. The facilitator sees both the data and the rationale and has to make a call.

**Late submission** — VP People submits 30 min before the meeting. Brief regenerates on the fly.

**Strategic omissions** — VP Eng silently lets P22 stagnate (Samantha Lee is pulled into P5). VP People hides concern about P19 pipeline. The AI catches the first one (stale progress) but not the second.

**Unrecorded dependencies** — P2 (Demo Portal) needs real AI workflow demos from P5, but no formal dependency exists. Future surprise.

**Unasked questions** — P17 completion frees 3 people. Neither VP CS nor VP Product has proposed where they go. The AI surfaces the reallocation options proactively.

> **The key insight: 24 minutes of async prep across 5 leaders surfaces 10 friction points that would have been invisible in a status doc. The AI doesn't resolve friction — it makes friction visible.**

---

## Summary: The Leader Experience

| Leader | Items to review | AI pre-fill accuracy | Updates submitted | Proposals | Time |
|--------|----------------|---------------------|-------------------|-----------|------|
| VP Engineering | 13 projects, 4 KRs | 3 flagged correctly, 10 on-track correct | 4 narratives | 3 proposals | ~8 min |
| VP Sales | 3 projects, 2 KRs | 1 override (KR1.2 not actually at risk) | 2 metric updates | 0 | ~3 min |
| VP Product | 4 projects, 4 KRs | All correct | 3 narratives + 1 early warning | 0 (co-signs 1) | ~5 min |
| VP People | 3 projects, 2 KRs | All correct | 1 narrative | 1 proposal (budget) | ~5 min |
| VP CS | 2 projects | 1 flagged ahead of schedule | 1 narrative | 1 proposal (accelerate) | ~3 min |
| **Total** | | | | **5 proposals → 5 decision cards** | **~24 min total** |
