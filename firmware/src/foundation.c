#include "foundation.h"

FoundationResult foundation_placeholder_result(SensorHeartbeat heartbeat)
{
    return (FoundationResult){
        .sequence = heartbeat.sequence,
        .tick = heartbeat.tick,
        .state = HANDLING_UNAVAILABLE,
        .classification_valid = false
    };
}
