#ifndef PARCELSENSE_FOUNDATION_H
#define PARCELSENSE_FOUNDATION_H
#include <stdbool.h>
#include <stdint.h>

typedef enum {
    HANDLING_UNAVAILABLE = 0,
    HANDLING_STABLE,
    HANDLING_NORMAL,
    HANDLING_ROUGH
} HandlingState;

typedef struct {
    uint32_t sequence;
    uint32_t tick;
    bool sensor_valid;
} SensorHeartbeat;

typedef struct {
    uint32_t sequence;
    uint32_t tick;
    HandlingState state;
    bool classification_valid;
} FoundationResult;

/* Phase 2 has no sensor/model: even a valid input cannot imply a prediction. */
FoundationResult foundation_placeholder_result(SensorHeartbeat heartbeat);
#endif
