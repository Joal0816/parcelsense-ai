#include "log_buffer.h"

void log_buffer_push(LogBuffer *buffer, LogRecord record)
{
    size_t tail = (buffer->head + buffer->count) % LOG_BUFFER_CAPACITY;
    buffer->records[tail] = record;
    if (buffer->count == LOG_BUFFER_CAPACITY) {
        buffer->head = (buffer->head + 1U) % LOG_BUFFER_CAPACITY;
        buffer->overwritten++;
    } else {
        buffer->count++;
    }
}

bool log_buffer_pop(LogBuffer *buffer, LogRecord *record)
{
    if (buffer->count == 0U) {
        return false;
    }
    *record = buffer->records[buffer->head];
    buffer->head = (buffer->head + 1U) % LOG_BUFFER_CAPACITY;
    buffer->count--;
    return true;
}
