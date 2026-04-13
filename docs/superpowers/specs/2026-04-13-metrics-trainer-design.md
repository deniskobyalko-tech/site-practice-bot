# Metrics Trainer — Design Spec

## Problem
Students need an interactive way to practice reading website metrics dashboards and diagnosing problems. The lecture covers 6 key metrics, but students struggle to apply them to real scenarios.

## Solution
An interactive metrics trainer — a randomized dashboard where students click metrics to learn what they mean, analyze the numbers, and reveal the diagnosis.

## Dashboard Structure

Single page with three blocks:

### 1. Header
- Title: "Тренажёр метрик"
- Button: "Новый сценарий" — regenerates all numbers

### 2. Metrics Grid
6 metric cards in a 2-column grid (mobile-friendly):

| Metric | Example | Tooltip content |
|--------|---------|-----------------|
| Визиты | 48 200 (+22%) | Unique visits. High traffic + high bounce = quality problem |
| Bounce Rate | 71% (+18%) | Formula: left without action / all visits × 100%. Norms: <40% great, 40-60% normal, >60% alarm |
| Время на сайте | 0:42 (−55%) | Long ≠ good. Read together with bounce rate and depth |
| CTR | 0.4% (−65%) | Formula: clicks / impressions × 100%. Search norm: 5-10%. <1% = bad headline |
| CPC | ₽84 (+30%) | Formula: ad spend / clicks. Lower = better. Improve relevance to reduce |
| CPA | ₽4 200 (+140%) | Formula: spend / target actions. Meaningless without LTV and margin |

Each card is clickable → shows tooltip with:
- Formula
- Norms/benchmarks
- Dynamic line: interpretation of current value (e.g., "71% — alarm, check landing page")

Color coding for dynamics: green = good direction, red = bad direction (system knows which direction is bad for each metric).

### 3. Diagnosis Block
- Button: "Показать диагноз"
- Reveals: problem description, root cause, recommended actions
- Hidden until clicked

## Scenario Generation

All client-side JavaScript. No backend needed.

### Problem Types (5 scenarios):

**1. Irrelevant traffic**
- Visits: high (30K-60K, +20-40%)
- Bounce Rate: 60-80% (+15-25%)
- Time on site: 0:15-0:45 (−40-60%)
- CTR: normal (3-8%)
- CPC: normal (₽40-90)
- CPA: high (₽3000-6000, +80-150%)
- Diagnosis: "Traffic source mismatch. Check UTM tags, review keywords, compare ad text with landing page."

**2. Bad ad copy**
- Visits: low (5K-15K, −30-50%)
- Bounce Rate: normal (30-45%)
- Time on site: normal (1:30-3:00)
- CTR: very low (0.2-0.8%, −50-70%)
- CPC: high (₽100-200, +40-80%)
- CPA: high (₽4000-8000, +100-200%)
- Diagnosis: "Ad doesn't attract clicks. Change headline, add USP, check competitors' ads."

**3. Broken funnel**
- Visits: normal (20K-35K, +5-15%)
- Bounce Rate: normal (30-45%)
- Time on site: normal (1:30-3:00)
- CTR: normal (3-8%)
- CPC: normal (₽40-90)
- CPA: very high (₽5000-10000, +100-200%)
- Diagnosis: "Traffic is fine, conversion is broken. Problem is on the page — test CTA, offer, form. Don't touch ad bids."

**4. Audience burnout**
- Visits: declining (10K-20K, −20-40%)
- Bounce Rate: growing (45-65%, +10-20%)
- Time on site: declining (0:40-1:20, −20-40%)
- CTR: declining (1-3%, −30-50%)
- CPC: growing (₽80-150, +30-60%)
- CPA: growing (₽3000-7000, +60-120%)
- Diagnosis: "Audience is exhausted. Refresh creatives, expand targeting, test new channels."

**5. Landing page problem**
- Visits: normal (20K-40K, +5-15%)
- Bounce Rate: very high (65-85%, +20-35%)
- Time on site: very low (0:10-0:30, −50-70%)
- CTR: normal (3-8%)
- CPC: normal (₽40-90)
- CPA: high (₽3000-6000, +80-140%)
- Diagnosis: "Ad is relevant, but landing page doesn't match expectations. Check page speed, content relevance, mobile UX."

### Value generation
For each metric, a random value is picked from the range defined for the selected problem type. Dynamics (%) are also randomized within the range.

## Tooltips

Static structure, dynamic last line:
```
[Formula]
[Norms]
[Current value interpretation — generated based on actual number]
```

Tooltip appears on click (not hover — mobile support). Closes on click outside or on another metric.

## Files

| File | Purpose |
|------|---------|
| `webapp/metrics.html` | Mini App version (with Telegram SDK) |
| `webapp/metrics-web.html` | Web version (no Telegram) |
| `webapp/js/metrics.js` | All logic: scenarios, tooltips, diagnosis (shared) |
| `webapp/css/style.css` | Extend existing styles for metric cards and tooltips |

## Bot Integration

In `bot.py`, add "Тренажёр метрик" button:
- For students: second button after "Начать практику"
- For admin: third button after existing two

URL points to `metrics.html` (Mini App) or `metrics-web.html` (web).

## What This Is NOT
- No backend API
- No authentication
- No data persistence
- No grading or submission
- Pure static page with client-side JS
