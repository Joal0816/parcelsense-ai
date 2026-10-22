#ifndef PARCELSENSE_APP_TASKS_H
#define PARCELSENSE_APP_TASKS_H
#include "FreeRTOS.h"
#include "task.h"
#include "foundation.h"
#include "log_buffer.h"

typedef struct {
    uint32_t completed_heartbeats;
    uint32_t minimum_free_heap;
    uint32_t stack_free_words[4]; /* Sensor, Inference, Feedback, Diagnostic */
    FoundationResult latest_result;
} DiagnosticSnapshot;

extern LogBuffer g_log_buffer;
extern volatile DiagnosticSnapshot g_diagnostics;
void app_tasks_start(void);
#endif
