# Laboratory report outline

Use this outline for the BCA182 Laboratory Activity No. 4 report. Replace bracketed prompts only with collected, attributable evidence. Mark unavailable board measurements **PENDING**; never estimate them from a host build.

## 1. Title and project summary

- ParcelSense AI, author/team, course/section, instructor, and submission date.
- One-paragraph goal: classify package handling into Stable, Normal Handling, and Rough Handling using offline embedded motion processing.
- State at submission: software foundation and pipeline status; exact hardware available or unavailable.

## 2. Requirements and design rationale

- Summarize the [requirements matrix](REQUIREMENTS.md).
- Explain the choice and alternatives in [project rationale](PROJECT_RATIONALE.md).
- Include the Sense → Process → Infer → Act → Record architecture and state which stages are implemented, interfaces-only, or pending.
- Identify the target as an intended STM32F407ZGT6 platform; report the exact RT-Spark revision only if inspected.

## 3. Implementation

- Repository and firmware foundation, task responsibilities, queues, status/fault behavior, and compile configuration.
- Sensor/UI interfaces and the evidence boundary around physical drivers.
- CSV schema, host processing, 24-feature order, trial-group split, baseline/tree comparison, and C export.
- Field Desk and optional loopback API as evidence-review tools, separate from the prediction path.

## 4. Test setup and methods

- Tool names and versions, exact commands, host OS, and test fixture provenance.
- Summarize the [test plan](TEST_PLAN.md) and link logs from [the evidence manifest](../evidence/README.md).
- Describe any instructor-approved label definitions and safe capture procedure. If not approved or not run, state that.

## 5. Results

### Software results

Report only checks that ran on the recorded source revision. Include host test outcomes, pipeline mechanics/parity results, PWA/local API checks, and MCU compile/link output. Separate link-time estimates from runtime memory measurements.

### Hardware and real-data results

Complete only with evidence: board identity, module diagnostics, dataset counts and provenance, split groups, held-out metrics, on-board prediction behavior, at least 50 timing observations, runtime heap/stack, and reliability/fault results. If unavailable, enter **Pending — board/data not available** for each item.

## 6. Discussion and limitations

- Discuss test scope, possible data leakage, trial diversity, label ambiguity, sensor limitations, and failure behavior.
- State plainly if synthetic fixtures were used; explain that they validate software mechanics only.
- Do not claim real accuracy, sensor validity, board compatibility, or embedded offline behavior without corresponding evidence.

## 7. Conclusion and next actions

- Summarize what the evidence establishes and what remains unverified.
- List the board-arrival and instructor-review steps from the [hardware checklist](BOARD_ARRIVAL_CHECKLIST.md).

## Appendices

- Reproduction commands and tool versions.
- Evidence manifest, build logs, test logs, pipeline report, raw-data checksums, and screenshots/photos **only if actually captured**.
- Repository commit ID and any deviations from the test plan.
