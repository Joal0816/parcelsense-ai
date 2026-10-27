# Blockers and dependencies

All hardware facts below are **UNVERIFIED** unless accompanied by recorded evidence. These are gates for later work, not Phase 1 failures.

| Blocker | Why it matters | Resolution evidence / phase |
|---|---|---|
| RT-Spark board is currently unavailable to the project operator | No physical inventory, sensor capture, upload, runtime diagnostic, or on-board timing can be performed; Phase 4 real-data evaluation and Phase 5 target inference remain gated | Obtain the board, record its revision/configuration, then collect reviewed evidence in Phases 3–5 |
| Exact RT-Thread RT-Spark board revision and installed configuration unknown | The checked-in F407ZG MCU profile is not an RT-Spark board definition; clock, memory map and peripheral mapping need board evidence | Photograph/label or authoritative board documentation; before upload and Phase 3 |
| Onboard sensors and interface modules not physically inspected | Software interfaces and candidate registry exist, but no module can be claimed present or tested | Inventory each module and verify its documentation; complete Phase 3 hardware gate |
| Pinout, buses, addresses, board clock, interrupt lines and electrical details unverified | Sensor/UI drivers must not choose a bus or pin until matching physical board evidence exists | Schematic plus board inspection and measured bring-up; complete Phase 3 hardware gate |
| Physical RT-Spark compatibility of `ststm32` manifest and linker map unverified | The local F407ZG metadata proves MCU tool support only; build success is not board compatibility | Verify revision, memory map, clock and debug/programming path; before upload |
| Provisional FreeRTOS periods/priorities/stacks unmeasured on target | Link-time stack allocations do not prove runtime headroom or timing | Run board task diagnostics, check high-water marks and interrupt behavior; Phase 2 hardware gate |
| Programmer/debug probe and host access unknown | Upload and on-target debug evidence unavailable | Identify probe and perform a controlled connection check; Phase 2 |
| No board-generated dataset or approved operational labeling procedure | Cannot train or evaluate useful handling classes; documented capture steps remain a draft and do not define force thresholds | Approve safe capture protocol and record independent labeled trials; Phase 4 |
| No board runtime or model performance measurements | Link-time Flash/RAM figures do not show runtime heap/stack headroom, latency or accuracy | Collect the metrics defined in requirements; Phases 4–6 |
| Mobile accessibility and storage field validation is incomplete | Automated desktop Chromium/Firefox checks do not represent real mobile screen readers, Safari/iOS behavior, browser eviction, or actual quota pressure | Complete the F5 assistive-technology, mobile-browser, storage-pressure, eviction, and device-matrix checks; record results without extrapolating from desktop |

Do not treat pending items as completed. Use the [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md) to collect hardware-dependent evidence. Record evidence, date, board revision, tool versions, and exact command for each resolved blocker.
