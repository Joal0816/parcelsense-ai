#ifndef PARCELSENSE_MODULE_DIAGNOSTICS_H
#define PARCELSENSE_MODULE_DIAGNOSTICS_H

#include <stddef.h>
#include <stdint.h>
#include "hardware/status.h"

#define MODULE_DIAGNOSTIC_CAPACITY 9U

typedef enum {
    MODULE_ICM20608_IMU = 0,
    MODULE_AP3216C_LIGHT_PROXIMITY,
    MODULE_AHT10_ENVIRONMENT,
    MODULE_DISPLAY,
    MODULE_INDICATORS,
    MODULE_BUZZER,
    MODULE_BUTTONS,
    MODULE_STORAGE,
    MODULE_CONNECTIVITY
} ModuleId;

typedef enum {
    MODULE_PRESENCE_UNVERIFIED = 0,
    MODULE_PRESENCE_ABSENT,
    MODULE_PRESENCE_PRESENT
} ModulePresence;

typedef enum {
    MODULE_HEALTH_UNVERIFIED = 0,
    MODULE_HEALTH_NOT_PROBED,
    MODULE_HEALTH_ABSENT,
    MODULE_HEALTH_READY,
    MODULE_HEALTH_FAULT
} ModuleHealth;

typedef struct {
    ModuleId id;
    const char *name;
    ModulePresence presence;
    ModuleHealth health;
    ParcelStatus last_status;
    uint32_t last_check_ms;
    uint32_t probe_attempts;
    uint32_t successful_probes;
    uint32_t failed_probes;
} ModuleDiagnostic;

typedef struct {
    ModuleDiagnostic entries[MODULE_DIAGNOSTIC_CAPACITY];
    size_t count;
    uint32_t diagnostic_cycles;
} ModuleDiagnosticRegistry;

typedef ParcelStatus (*ModuleProbeFn)(void *context, ModuleId id);

/* Mutable operations have a single owner: initialize before scheduling, then
 * call set_presence/run from DiagnosticTask only. Other tasks must not inspect
 * entries while that owner updates them without an explicit snapshot/lock.
 * Callbacks run in task context, never from an ISR. A NULL probe for a module
 * marked PRESENT is reported as NOT_PROBED / NOT_INITIALIZED. */
void module_diagnostics_init(ModuleDiagnosticRegistry *registry);
const ModuleDiagnostic *module_diagnostics_get(
    const ModuleDiagnosticRegistry *registry, ModuleId id);
ParcelStatus module_diagnostics_set_presence(
    ModuleDiagnosticRegistry *registry, ModuleId id, ModulePresence presence);
void module_diagnostics_run(ModuleDiagnosticRegistry *registry,
                            ModuleProbeFn probe, void *context, uint32_t now_ms);

#endif
