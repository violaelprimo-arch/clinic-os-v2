# E2E Test Infra: Yalla Clinic SaaS Platform

## Test Philosophy
- Opaque-box, requirement-driven derived from `ORIGINAL_REQUEST.md` and user-facing specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Multi-Tenant Isolation: Strictly isolated synthetic test fixtures (`e2e-clinic-alpha` and `e2e-clinic-beta`) with automated setup and teardown. Zero mutation of live/production patient records.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Platform Owner Governance | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 2 | Doctor Clinical & Queue Workflow | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 3 | Receptionist Registration & Billing | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 4 | Patient Booking & Queue Tracking | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 5 | Multi-Tenant Data Isolation & Security | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| 6 | Cloudflare Worker Stability (%2B & CPU) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 7 | Real-Time TV Queue & Voice Engine | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Test Architecture
- **Runner**: Playwright (`@playwright/test`)
- **Configuration**: `playwright.config.ts`
- **Invocation**: `npx playwright test`
- **Output Formats**: HTML report, JUnit XML, line console output
- **Directory Layout**:
  - `tests/e2e/01-owner.spec.ts` (Platform Owner flows)
  - `tests/e2e/02-doctor.spec.ts` (Doctor examination, queue call, prescription PDF)
  - `tests/e2e/03-receptionist.spec.ts` (Walk-in, queue triage, thermal receipts, discounts)
  - `tests/e2e/04-patient.spec.ts` (Public booking, Egyptian phone validation, live tracking, directions)
  - `tests/e2e/05-multi-tenant-sec.spec.ts` (Cross-tenant leak prevention, IDOR, %2B URL encoding)
  - `tests/fixtures/synthetic-data.ts` (Synthetic clinic & appointment seed/teardown)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Clinic Lifecycle | Owner provisions clinic -> Receptionist books walk-in -> Doctor examines & prescribes -> Receptionist collects cash | High |
| 2 | Emergency Priority Re-sorting | Normal queue -> Emergency patient arrives -> Jumps to head of queue -> Doctor calls emergency -> TV updates | High |
| 3 | Cross-Tenant Attack Rejection | Patient from Clinic A attempts to access Clinic B records via IDOR or URL injection -> Blocked with 404 | High |
| 4 | URL Encoded Patient Record Audit | Patient with international dial code `%2B20...` retrieved, examined, prescriptions rendered | Medium |
| 5 | Discount & Financial Reconciliation | Walk-in with 20% discount -> Accounts ledger accurately reflects net revenue and original price | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature (boundary and corner cases)
- Tier 3: Pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
