#ifndef PARCELSENSE_HARDWARE_UI_H
#define PARCELSENSE_HARDWARE_UI_H

#include <stdbool.h>
#include <stdint.h>
#include "hardware/status.h"

typedef enum {
    UI_STATE_UNAVAILABLE = 0,
    UI_STATE_STABLE,
    UI_STATE_NORMAL_HANDLING,
    UI_STATE_ROUGH_HANDLING
} UiClassification;

typedef ParcelStatus (*UiDiagnoseFn)(void *context);
typedef ParcelStatus (*DisplayShowFn)(void *context, UiClassification state);
typedef ParcelStatus (*IndicatorSetFn)(void *context, UiClassification state);
typedef ParcelStatus (*BuzzerSetFn)(void *context, bool enabled);
typedef ParcelStatus (*ButtonsReadFn)(void *context, uint32_t *events);

typedef struct {
    void *context;
    UiDiagnoseFn diagnose;
    DisplayShowFn show;
} DisplayInterface;

typedef struct {
    void *context;
    UiDiagnoseFn diagnose;
    IndicatorSetFn set;
} IndicatorInterface;

typedef struct {
    void *context;
    UiDiagnoseFn diagnose;
    BuzzerSetFn set;
} BuzzerInterface;

typedef struct {
    void *context;
    UiDiagnoseFn diagnose;
    ButtonsReadFn read;
} ButtonsInterface;

#endif
