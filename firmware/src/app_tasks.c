#include "app_tasks.h"
#include "queue.h"

static QueueHandle_t sensor_queue;
static QueueHandle_t feedback_queue;
static TaskHandle_t sensor_task, inference_task, feedback_task, diagnostic_task;
LogBuffer g_log_buffer;
volatile DiagnosticSnapshot g_diagnostics;

enum { LOG_FEEDBACK_UNAVAILABLE = 1, LOG_HEAP_MINIMUM = 2 };

/* Task-context only; never blocks the producer on I/O. */
static void record_event(uint32_t event, uint32_t value)
{
    LogRecord record = {xTaskGetTickCount(), event, value};
    taskENTER_CRITICAL();
    log_buffer_push(&g_log_buffer, record);
    taskEXIT_CRITICAL();
}

static void SensorTask(void *argument)
{
    (void)argument;
    TickType_t wake = xTaskGetTickCount();
    uint32_t sequence = 0U;
    for (;;) {
        /* Liveness metadata only: no invented motion samples. */
        SensorHeartbeat heartbeat = {sequence++, xTaskGetTickCount(), false};
        configASSERT(xQueueOverwrite(sensor_queue, &heartbeat) == pdPASS);
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(100));
    }
}

static void InferenceTask(void *argument)
{
    (void)argument;
    SensorHeartbeat heartbeat;
    for (;;) {
        if (xQueueReceive(sensor_queue, &heartbeat, portMAX_DELAY) == pdPASS) {
            FoundationResult result = foundation_placeholder_result(heartbeat);
            configASSERT(xQueueOverwrite(feedback_queue, &result) == pdPASS);
        }
    }
}

static void FeedbackTask(void *argument)
{
    (void)argument;
    FoundationResult result;
    for (;;) {
        if (xQueueReceive(feedback_queue, &result, portMAX_DELAY) == pdPASS) {
            g_diagnostics.latest_result = result;
            record_event(LOG_FEEDBACK_UNAVAILABLE, result.sequence);
            xTaskNotifyGive(diagnostic_task);
        }
    }
}

static void DiagnosticTask(void *argument)
{
    (void)argument;
    for (;;) {
        /* Notifications count completed placeholders; timeout allows idle checks. */
        uint32_t completed = ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(1000));
        g_diagnostics.completed_heartbeats += completed;
        g_diagnostics.minimum_free_heap = xPortGetMinimumEverFreeHeapSize();
        g_diagnostics.stack_free_words[0] = uxTaskGetStackHighWaterMark(sensor_task);
        g_diagnostics.stack_free_words[1] = uxTaskGetStackHighWaterMark(inference_task);
        g_diagnostics.stack_free_words[2] = uxTaskGetStackHighWaterMark(feedback_task);
        g_diagnostics.stack_free_words[3] = uxTaskGetStackHighWaterMark(NULL);
        record_event(LOG_HEAP_MINIMUM, g_diagnostics.minimum_free_heap);
    }
}

void app_tasks_start(void)
{
    /* Single-slot latest-value mailboxes: bounded RAM, no stale backlog. */
    sensor_queue = xQueueCreate(1U, sizeof(SensorHeartbeat));
    feedback_queue = xQueueCreate(1U, sizeof(FoundationResult));
    configASSERT(sensor_queue != NULL && feedback_queue != NULL);
    vQueueAddToRegistry(sensor_queue, "sensor");
    vQueueAddToRegistry(feedback_queue, "feedback");
    /* Stack depths are 32-bit words, provisional until measured on board.
     * All handles exist before the scheduler can run a producer. */
    configASSERT(xTaskCreate(SensorTask, "SensorTask", 256U, NULL, 3U, &sensor_task) == pdPASS);
    configASSERT(xTaskCreate(InferenceTask, "InferenceTask", 384U, NULL, 2U, &inference_task) == pdPASS);
    configASSERT(xTaskCreate(FeedbackTask, "FeedbackTask", 256U, NULL, 2U, &feedback_task) == pdPASS);
    configASSERT(xTaskCreate(DiagnosticTask, "DiagnosticTask", 384U, NULL, 1U, &diagnostic_task) == pdPASS);
    vTaskStartScheduler();
    foundation_assert_failed(__FILE__, __LINE__); /* Scheduler allocation failure. */
}
