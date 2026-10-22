# Blockers and dependencies

All hardware facts below are **UNVERIFIED** unless accompanied by recorded evidence. These are gates for later work, not Phase 1 failures.

| Blocker | Why it matters | Resolution evidence / phase |
|---|---|---|
| Exact RT-Thread RT-Spark board revision and installed configuration unknown | The checked-in F407ZG MCU profile is not an RT-Spark board definition; clock, memory map and peripheral mapping need board evidence | Photograph/label or authoritative board documentation; before upload and Phase 3 |
| Onboard sensors and interface modules not physically inspected | Cannot implement or claim sensor/UI support or diagnostics | Inventory each module and verify its documentation; Phase 3 |
| Pinout, buses, addresses, board clock, interrupt lines and electrical details unverified | Drivers and clock assumptions need matching physical board evidence | Schematic plus board inspection and measured bring-up; Phase 3 |
| Physical RT-Spark compatibility of `ststm32` manifest and linker map unverified | The local F407ZG metadata proves MCU tool support only; build success is not board compatibility | Verify revision, memory map, clock and debug/programming path; before upload |
| Provisional FreeRTOS periods/priorities/stacks unmeasured on target | Link-time stack allocations do not prove runtime headroom or timing | Run board task diagnostics, check high-water marks and interrupt behavior; Phase 2 hardware gate |
| Programmer/debug probe and host access unknown | Upload and on-target debug evidence unavailable | Identify probe and perform a controlled connection check; Phase 2 |
| No board-generated dataset or repeatable labeling procedure | Cannot train or evaluate useful handling classes | Approve safe capture protocol and record independent labeled trials; Phase 4 |
| No board runtime or model performance measurements | Link-time Flash/RAM figures do not show runtime heap/stack headroom, latency or accuracy | Collect the metrics defined in requirements; Phases 4–6 |

Do not treat pending items as completed. Record evidence, date, board revision, tool versions, and exact command for each resolved blocker.
