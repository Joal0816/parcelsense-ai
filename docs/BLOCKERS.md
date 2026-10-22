# Blockers and dependencies

All hardware facts below are **UNVERIFIED** unless accompanied by recorded evidence. These are gates for later work, not Phase 1 failures.

| Blocker | Why it matters | Resolution evidence / phase |
|---|---|---|
| Exact RT-Thread RT-Spark board revision and installed configuration unknown | Board manifest, startup, clocks, memory map and peripheral mapping depend on revision | Photograph/label or authoritative board documentation; Phase 2 |
| Onboard sensors and interface modules not physically inspected | Cannot implement or claim sensor/UI support or diagnostics | Inventory each module and verify its documentation; Phase 3 |
| Pinout, buses, addresses, clocks, interrupt lines and electrical details unverified | Invented mappings could damage hardware or produce invalid readings | Schematic plus board inspection and measured bring-up; Phase 2/3 |
| PlatformIO board manifest / `ststm32` + `stm32cube` support unverified | Generic STM32F407 settings do not prove RT-Spark compatibility | Verify manifest, startup/linker settings and successful target build; Phase 2 |
| FreeRTOS source/configuration and interrupt/tick ownership not selected | HAL tick, RTOS tick, Cortex-M4F port and priority rules must agree | Document integration and compile; Phase 2 |
| Programmer/debug probe and host access unknown | Upload and on-target debug evidence unavailable | Identify probe and perform a controlled connection check; Phase 2 |
| No board-generated dataset or repeatable labeling procedure | Cannot train or evaluate useful handling classes | Approve safe capture protocol and record independent labeled trials; Phase 4 |
| No performance or resource measurements | Accuracy, latency, Flash/RAM, heap and stack claims cannot be made | Collect the metrics defined in requirements; Phases 4–6 |

Do not treat pending items as completed. Record evidence, date, board revision, tool versions, and exact command for each resolved blocker.
