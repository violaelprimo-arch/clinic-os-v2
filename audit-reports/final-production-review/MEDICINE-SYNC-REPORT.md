# Medicine Directory & Price Sync Report
**External Source:** DawaaGate (`https://www.dawaagate.com/`)  
**Storage Collection:** `market_prices` (Firestore)  
**Distributed Lock:** `sync_locks/market_prices` (15 min lease)  
**Audit Collection:** `market_prices_sync_logs`  
**Execution Timezone:** `Africa/Cairo`  

---

## 1. Synchronization Architecture

### Data Ingestion
1. **Recent Price Updates:** Scraped via Cheerio from `https://www.dawaagate.com/price-updates` (paginated table with drug name, old price, new price, percentage change, and modification date).
2. **Metadata Enrichment:** When new medicines are detected, detailed pages (`https://www.dawaagate.com/medicine/[slug]`) are inspected to parse:
   - English commercial name (`alternateName`)
   - Arabic commercial name (`name`)
   - Active ingredient (`activeIngredient`)
   - Pharmaceutical company (`manufacturer`)
   - Dosage form (`dosageForm`)
   - Medical category (`category`)
   - GTIN-13 barcode (`gtin13`)
3. **Keyword Targeted Sync:** When users search or click "تحديث فورياً", `https://www.dawaagate.com/search?q=...` is queried on demand.

---

## 2. Safe Database Upsert & Integrity Rules

- **Price Validation:** Every price is parsed as a floating-point number. Prices `<= 0`, `NaN`, or missing are strictly dropped.
- **Idempotency & Change Detection:**
  - If a drug document exists with the identical price, Arabic name, and `last_updated === todayCairoDate`, write is skipped and `unchangedCount` is incremented.
  - If the price has changed, `price` is updated, `oldPrice` is preserved, `last_updated` is set to today, and `updatedCount` is incremented.
  - If the drug is new to the database, a new document is created with full metadata and `addedCount` is incremented.
- **Non-Destructive Guarantee:** Sync operations NEVER execute delete operations on `market_prices`. Medicines not present in the latest updates batch remain permanently intact in the catalog.
- **Distributed Concurrency Lock:**
  - Located at `sync_locks/market_prices`.
  - Stored with `lockedAt` and `lockedBy`.
  - Automatically expires after 15 minutes to prevent stale deadlocks.
  - Released in a `finally` block on completion.

---

## 3. Daily Automated Scheduling (06:00 AM Cairo Time)

### Egypt Timezone Consideration
- Winter: UTC+2 -> 06:00 AM Cairo = **04:00 AM UTC** (`0 4 * * *`)
- Summer: UTC+3 -> 06:00 AM Cairo = **03:00 AM UTC** (`0 3 * * *`)

### Wrangler Configuration
```toml
[triggers]
crons = ["0 3 * * *", "0 4 * * *"]
```

When Cloudflare triggers the cron, the handler evaluates Cairo hour via `Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric' })`. If hour equals 6 and today's date has not been completed, it executes the full sync and records the result in `market_prices_sync_logs`.

---

## 4. UI Controls & Monitoring

1. **Doctor Drug Catalog (`/clinic/[slug]/admin/drugs`):**
   - Shows latest sync date badge (`last_updated_on: YYYY-MM-DD`).
   - Displays real-time sync metrics badge (`+X new | Y updated | Z unchanged`).
   - Manual sync button triggers `POST /api/sync-daily-prices` with live toast feedback.
2. **Owner Dashboard (`/owner` -> Settings tab):**
   - `MedicineSyncMonitorWidget` displays engine health, next scheduled run, latest sync date/time, and a full audit log table showing recent executions.
