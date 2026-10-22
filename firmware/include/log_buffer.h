#ifndef PARCELSENSE_LOG_BUFFER_H
#define PARCELSENSE_LOG_BUFFER_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define LOG_BUFFER_CAPACITY 32U

typedef struct {
    uint32_t tick;
    uint32_t event;
    uint32_t value;
} LogRecord;

typedef struct {
    LogRecord records[LOG_BUFFER_CAPACITY];
    size_t head;
    size_t count;
    uint32_t overwritten;
} LogBuffer;

/* Zero-initialize before use. Caller serializes access; no ISR/RTOS dependency.
 * Full buffer retains newest events and counts overwritten oldest records. */
void log_buffer_push(LogBuffer *buffer, LogRecord record);
bool log_buffer_pop(LogBuffer *buffer, LogRecord *record);
#endif
