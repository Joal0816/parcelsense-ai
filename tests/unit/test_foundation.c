#include <assert.h>
#include <stdio.h>
#include "foundation.h"
#include "log_buffer.h"

int main(void)
{
    for (unsigned valid = 0; valid < 2; valid++) {
        SensorHeartbeat heartbeat = {UINT32_MAX, 123U, valid != 0};
        FoundationResult result = foundation_placeholder_result(heartbeat);
        assert(result.sequence == heartbeat.sequence && result.tick == heartbeat.tick);
        assert(!result.classification_valid && result.state == HANDLING_UNAVAILABLE);
    }
    LogBuffer buffer = {0};
    LogRecord record = {0};
    assert(!log_buffer_pop(&buffer, &record));
    /* Overflow, overwrite accounting, FIFO order and wrap-around. */
    for (uint32_t i = 0; i < 3U * LOG_BUFFER_CAPACITY; i++) {
        log_buffer_push(&buffer, (LogRecord){i, 7U, i + 1U});
    }
    assert(buffer.count == LOG_BUFFER_CAPACITY);
    assert(buffer.overwritten == 2U * LOG_BUFFER_CAPACITY);
    for (uint32_t i = 2U * LOG_BUFFER_CAPACITY; i < 3U * LOG_BUFFER_CAPACITY; i++) {
        assert(log_buffer_pop(&buffer, &record));
        assert(record.tick == i && record.event == 7U && record.value == i + 1U);
    }
    assert(!log_buffer_pop(&buffer, &record));
    log_buffer_push(&buffer, (LogRecord){42U, 1U, 99U});
    assert(log_buffer_pop(&buffer, &record) && record.value == 99U);
    puts("PASS: placeholder validity, metadata, empty/full/wrapped log buffer");
    return 0;
}
