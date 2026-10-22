#include "hardware/module_diagnostics.h"

typedef struct { ModuleId id; const char *name; } ModuleCatalogItem;

static const ModuleCatalogItem catalog[MODULE_DIAGNOSTIC_CAPACITY] = {
    {MODULE_ICM20608_IMU, "ICM20608 IMU"},
    {MODULE_AP3216C_LIGHT_PROXIMITY, "AP3216C light/proximity"},
    {MODULE_AHT10_ENVIRONMENT, "AHT10 temperature/humidity"},
    {MODULE_DISPLAY, "Display"},
    {MODULE_INDICATORS, "LED/LED matrix"},
    {MODULE_BUZZER, "Buzzer"},
    {MODULE_BUTTONS, "Buttons"},
    {MODULE_STORAGE, "Storage"},
    {MODULE_CONNECTIVITY, "Connectivity"}
};

static ModuleDiagnostic *find_mutable(ModuleDiagnosticRegistry *registry, ModuleId id)
{
    if (registry == NULL) return NULL;
    for (size_t i = 0; i < registry->count; ++i) {
        if (registry->entries[i].id == id) return &registry->entries[i];
    }
    return NULL;
}

void module_diagnostics_init(ModuleDiagnosticRegistry *registry)
{
    if (registry == NULL) return;
    *registry = (ModuleDiagnosticRegistry){0};
    registry->count = MODULE_DIAGNOSTIC_CAPACITY;
    for (size_t i = 0; i < registry->count; ++i) {
        registry->entries[i] = (ModuleDiagnostic){
            .id = catalog[i].id,
            .name = catalog[i].name,
            .presence = MODULE_PRESENCE_UNVERIFIED,
            .health = MODULE_HEALTH_UNVERIFIED,
            .last_status = PARCEL_STATUS_UNVERIFIED
        };
    }
}

const ModuleDiagnostic *module_diagnostics_get(
    const ModuleDiagnosticRegistry *registry, ModuleId id)
{
    if (registry == NULL) return NULL;
    for (size_t i = 0; i < registry->count; ++i) {
        if (registry->entries[i].id == id) return &registry->entries[i];
    }
    return NULL;
}

ParcelStatus module_diagnostics_set_presence(
    ModuleDiagnosticRegistry *registry, ModuleId id, ModulePresence presence)
{
    ModuleDiagnostic *entry = find_mutable(registry, id);
    if (entry == NULL || (presence != MODULE_PRESENCE_UNVERIFIED &&
                          presence != MODULE_PRESENCE_ABSENT &&
                          presence != MODULE_PRESENCE_PRESENT)) {
        return PARCEL_STATUS_INVALID_ARGUMENT;
    }
    entry->presence = presence;
    entry->health = presence == MODULE_PRESENCE_UNVERIFIED
        ? MODULE_HEALTH_UNVERIFIED
        : (presence == MODULE_PRESENCE_ABSENT ? MODULE_HEALTH_ABSENT : MODULE_HEALTH_NOT_PROBED);
    entry->last_status = presence == MODULE_PRESENCE_UNVERIFIED
        ? PARCEL_STATUS_UNVERIFIED
        : (presence == MODULE_PRESENCE_ABSENT ? PARCEL_STATUS_ABSENT : PARCEL_STATUS_NOT_INITIALIZED);
    return PARCEL_STATUS_OK;
}

void module_diagnostics_run(ModuleDiagnosticRegistry *registry,
                            ModuleProbeFn probe, void *context, uint32_t now_ms)
{
    if (registry == NULL) return;
    registry->diagnostic_cycles++;
    for (size_t i = 0; i < registry->count; ++i) {
        ModuleDiagnostic *entry = &registry->entries[i];
        entry->last_check_ms = now_ms;
        if (entry->presence == MODULE_PRESENCE_UNVERIFIED) {
            entry->health = MODULE_HEALTH_UNVERIFIED;
            entry->last_status = PARCEL_STATUS_UNVERIFIED;
            continue;
        }
        if (entry->presence == MODULE_PRESENCE_ABSENT) {
            entry->health = MODULE_HEALTH_ABSENT;
            entry->last_status = PARCEL_STATUS_ABSENT;
            continue;
        }
        if (probe == NULL) {
            entry->health = MODULE_HEALTH_NOT_PROBED;
            entry->last_status = PARCEL_STATUS_NOT_INITIALIZED;
            continue;
        }
        entry->probe_attempts++;
        entry->last_status = probe(context, entry->id);
        if (entry->last_status == PARCEL_STATUS_OK) {
            entry->health = MODULE_HEALTH_READY;
            entry->successful_probes++;
        } else {
            entry->health = MODULE_HEALTH_FAULT;
            entry->failed_probes++;
        }
    }
}
