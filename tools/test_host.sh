#!/usr/bin/env sh
set -eu
mkdir -p .pio/host-tests
${CC:-cc} -std=c11 -Wall -Wextra -Werror -pedantic \
    -fsanitize=address,undefined -g -I firmware/include \
    -I tests/support tests/unit/test_foundation.c tests/support/mock_hardware.c \
    firmware/src/foundation.c firmware/src/classifier.c firmware/src/features.c \
    firmware/src/inference.c \
    firmware/src/log_buffer.c \
    firmware/src/sensor_validation.c firmware/src/module_diagnostics.c \
    -lm -o .pio/host-tests/test_foundation
ASAN_OPTIONS=detect_leaks=0 .pio/host-tests/test_foundation
