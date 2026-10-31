# TEST_READY: Playwright E2E Automated Test Suite Specification & Runner Guide

**Project**: Clinic OS V2 (Yalla Clinic SaaS)  
**Target Environment**: Next.js 16 (App Router) on Cloudflare Workers / Node.js Runtime  
**Locale & Timezone**: `ar-EG` / `Africa/Cairo`  
**Framework**: Playwright (`@playwright/test` v1.63.0)  
**Configuration**: `playwright.config.ts`  
**Test Root**: `tests/e2e/`  

---

## 1. Test Architecture & Runner Invocations

All tests are strictly automated, deterministic, and self-contained. Synthetic data fixtures guarantee **zero modification, query, or deletion of live/production patient records**.

### Primary Test Commands

| Scope | Execution Command | Description |
| :--- | :--- | :--- |
| **All E2E Suites** | `npx playwright test` | Executes all 5 persona and security suites (Desktop & Mobile) |
| **Type Check Integrity** | `npx tsc --noEmit` | Strict TypeScript verification (0 errors required) |
| **Persona 1: Owner** | `npx playwright test tests/e2e/01-owner.spec.ts` | Platform owner governance, provisioning, subscriptions, suspension guards |
| **Persona 2: Doctor** | `npx playwright test tests/e2e/02-doctor.spec.ts` | Queue calling, clinical examination, Rx protocol, A4 PDF preview, vital signs |
| **Persona 3: Receptionist** | `npx playwright test tests/e2e/03-receptionist.spec.ts` | Walk-in registration, skip & priorityNext transitions, discounts, 80mm thermal receipts |
| **Persona 4: Patient** | `npx playwright test tests/e2e/04-patient.spec.ts` | Multi-step booking, Egyptian mobile validation, live queue tracking, GPS directions |
| **Multi-Tenant Security** | `npx playwright test tests/e2e/05-multi-tenant-sec.spec.ts` | Cross-tenant leak prevention, %2B URL decoding, invoice/Rx IDOR guards |
| **Interactive UI Mode** | `npx playwright test --ui` | Visual test debugging and step-by-step tracing |
| **Report Generation** | `npx playwright show-report` | HTML execution report with screenshots and video artifacts |

---

## 2. 4-Tier Test Coverage Matrix

The suite is structured following the 4-tier testing methodology:
- **Tier 1**: Feature Coverage (Happy Path & Core Contract)
- **Tier 2**: Boundary, Corner Cases & Input Validation
- **Tier 3**: Cross-Feature Interactions & Concurrency
- **Tier 4**: Real-World End-to-End Application Scenarios

| # | Feature / Area | Persona / Scope | Test Spec Path | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Verification Status |
|---|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | **Platform Owner Governance** | Super Admin | `tests/e2e/01-owner.spec.ts` | ✓ | ✓ | ✓ | ✓ | **READY** |
| 2 | **Doctor Clinical & Queue** | Doctor | `tests/e2e/02-doctor.spec.ts` | ✓ | ✓ | ✓ | ✓ | **READY** |
| 3 | **Receptionist Front-Desk** | Assistant | `tests/e2e/03-receptionist.spec.ts` | ✓ | ✓ | ✓ | ✓ | **READY** |
| 4 | **Patient Public Self-Service** | Patient | `tests/e2e/04-patient.spec.ts` | ✓ | ✓ | ✓ | ✓ | **READY** |
| 5 | **Multi-Tenant Data Isolation** | Platform Security | `tests/e2e/05-multi-tenant-sec.spec.ts` | ✓ | ✓ | ✓ | ✓ | **READY** |
| 6 | **Percent-Encoded URL Handling** | Runtime Stability | `tests/e2e/05-multi-tenant-sec.spec.ts` | ✓ | ✓ | ✓ | — | **READY** |
| 7 | **IDOR Prevention (Invoice & Rx)** | Financial & Medical Security | `tests/e2e/05-multi-tenant-sec.spec.ts` | ✓ | — | ✓ | ✓ | **READY** |

---

## 3. Synthetic Data Sandboxing & Isolation Guarantees

Strict multi-tenant sandboxing is enforced via `tests/fixtures/synthetic-data.ts`:

1. **Namespace Isolation**:
   - Tenant Alpha: `synth-clinic-alpha` (`slug: e2e-clinic-alpha`)
   - Tenant Beta: `synth-clinic-beta` (`slug: e2e-clinic-beta`)
   - Tenant Gamma (Suspended Guard): `synth-clinic-gamma` (`slug: synth-clinic-gamma`)
2. **Production Safety**:
   - All synthetic appointment documents are prefixed with `synth-appt-*`.
   - Setup and teardown hooks reset in-memory synthetic state and purge only `synth-*` records.
   - Zero production databases or live patient records are altered, queried, or deleted.
3. **Session Mocking & Route Interception**:
   - `setupSyntheticHarness(page, options)` handles mock Google Identity/Firebase tokens, internal server authentication (`/api/auth/login`), patient portal sessions, and booking endpoints.

---

## 4. Test Directory Layout

```
clinic-os-v2/
├── playwright.config.ts                     # Unified E2E Playwright configuration
├── TEST_READY.md                            # Test runner specification & coverage summary
├── tests/
│   ├── e2e/
│   │   ├── 01-owner.spec.ts                 # Persona 1: Platform Owner suite
│   │   ├── 02-doctor.spec.ts                # Persona 2: Doctor clinical & queue suite
│   │   ├── 03-receptionist.spec.ts          # Persona 3: Receptionist & billing suite
│   │   ├── 04-patient.spec.ts               # Persona 4: Public booking & tracking suite
│   │   └── 05-multi-tenant-sec.spec.ts      # Multi-tenant security & IDOR suite
│   ├── fixtures/
│   │   └── synthetic-data.ts                # Synthetic clinic definitions, seed & teardown
│   └── helpers/
│       └── test-utils.ts                    # Persona login helpers, RTL assertion, toasts
```

---

## 5. Verification Checklist

- [x] Arabic locale (`ar-EG`) and Cairo timezone (`Africa/Cairo`) configured in `playwright.config.ts`.
- [x] Zero TypeScript errors: `npx tsc --noEmit` exits with code 0.
- [x] Total of 28 Playwright tests discovered across Desktop Chromium and Mobile Patient projects (`npx playwright test --list`).
- [x] Strict tenant isolation verified between Clinic Alpha and Clinic Beta.
- [x] Percent-encoded patient ID (`%2B20...`) handled without 500 error or CPU timeout.
- [x] IDOR protection verified for electronic invoices and prescriptions.
