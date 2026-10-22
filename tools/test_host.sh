#!/usr/bin/env sh
set -eu
mkdir -p .pio/host-tests
${CC:-cc} -std=c11 -Wall -Wextra -Werror -pedantic \
    -fsanitize=address,undefined -g -I firmware/include \
    tests/unit/test_foundation.c firmware/src/foundation.c firmware/src/log_buffer.c \
    -o .pio/host-tests/test_foundation
ASAN_OPTIONS=detect_leaks=0 .pio/host-tests/test_foundation
