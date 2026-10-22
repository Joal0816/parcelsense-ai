# Firmware build instructions

## Local software requirements

Use PlatformIO Core with the versions pinned in `platformio.ini`: `ststm32` 20.0.0, STM32CubeF4 1.28.3, and the ARM GCC 12.3.1 package. `pio run` resolves missing packages through PlatformIO; the Phase 2 build used packages already installed locally. No UART, upload, or board connection is needed for compilation. Host checks use `cc` plus AddressSanitizer and UndefinedBehaviorSanitizer.

## Commands

From the repository root:

```sh
pio run
sh tools/test_host.sh
python3 -m unittest discover -s tests/ml -v
```

The build environment is `rtspark_f407zg_hsi`, using `platform = ststm32`, `framework = stm32cube`, the project board manifest, CubeF4 HAL/LL, and FreeRTOS `ARM_CM4F` plus `heap_4`. Firmware output is under `.pio/build/rtspark_f407zg_hsi/`. The linker map is `firmware.map` in that directory.

The local manifest sets STM32F407ZGT6, 16 MHz internal HSI, 1 MiB Flash, and 128 KiB main SRAM. These are MCU profile settings, not verified RT-Spark oscillator, clock, upload, or pin mappings. Do not upload until the board revision, programmer, and board-specific setup have been checked. A successful cross-build does not mean the program has run on the board.

## Phase 2 build record

Build command: `pio run` — **PASS**, using PlatformIO Core 6.2.0, `ststm32` 20.0.0, STM32CubeF4 1.28.3, and GNU Arm Embedded 12.3.1. Full output and exit status: `evidence/build/phase2-pio-run.log`.

PlatformIO reports 9,524 bytes Flash and 25,380 bytes RAM. The ELF section report shows 9,940 bytes in the raw binary, including the 392-byte interrupt vector and initialized sections; `.data` + `.bss` use 25,380 bytes. The linker also reserves 2,052 bytes for the initial process stack and zero C-library heap, putting static main SRAM use plus that reserve at 27,432 bytes. The 24 KiB FreeRTOS `heap_4` arena is included in `.bss`; its runtime free/minimum values and task stack high-water marks are **not available until execution**. CCM is unused.

The linker emits expected newlib syscall warnings (`_read`, `_write`, `_close`, `_lseek` are unimplemented) because this foundation has no console, plus an RWX load-segment warning from the inherited STM32 linker layout. The build has three CubeF4 `-Wextra` unused-parameter warnings. These warnings do not prevent the image from linking. Review memory sections and these warnings if adding console, bootloader, or MPU requirements.

Host command: `sh tools/test_host.sh` — **PASS**. Results: `evidence/tests/phase2-host-tests.log`. The current test also checks the host-testable classifier callback contract, including feature count, finite values, valid class mapping, invalid return codes, and unavailable fallback. The callback fixture is not a trained model. Tests do not exercise FreeRTOS scheduling or hardware.

## Phase 3 interface build

After adding the typed sensor interfaces and module registry, `pio run` passed again. PlatformIO reports 9,956 bytes Flash and 25,640 bytes RAM; the increase is limited to the software interface/diagnostic code and static registry. The exact output is in `evidence/build/phase3-pio-run.log`. Host tests now include validation and injected fault cases; see `evidence/tests/phase3-host-tests.log`. Both figures are link-time estimates, not on-board runtime measurements.

## Phase 4 host pipeline

See [ML pipeline guide](ML_PIPELINE.md) for the CSV schema, capture protocol, processing outputs, and evidence limits. The ML smoke test uses only temporary synthetic fixtures. It requires Python 3 standard library and a host C compiler for the C parity case; the compiler-specific test is skipped if `cc` is unavailable. No trained model or board dataset is committed.

## Classifier integration preparation

`firmware/src/classifier.c` validates the 24-feature model ABI emitted by the pipeline and maps valid model result indices to the three UI states. It rejects invalid inputs/results while keeping the output unavailable. `InferenceTask` does not call this adapter; no trained model is linked. The `pio run` smoke build on the current tree passed with 9,956 bytes Flash and 25,640 bytes RAM reported. A cross-language test checks that the firmware feature count matches the pipeline feature list. These checks validate interfaces only, not prediction quality, target execution, or runtime memory.
