#ifndef PARCELSENSE_TEST_MOCK_HARDWARE_H
#define PARCELSENSE_TEST_MOCK_HARDWARE_H

#include "hardware/module_diagnostics.h"
#include "hardware/sensors.h"

/* Test-only fixture. Never included by the PlatformIO firmware build. */
typedef struct {
    ParcelStatus probe_result;
    unsigned probe_calls;
    ModuleId last_module;
    MotionSample motion_fixture;
    LightProximitySample light_fixture;
    EnvironmentSample environment_fixture;
} MockHardware;

ParcelStatus mock_module_probe(void *context, ModuleId id);
ParcelStatus mock_motion_read(void *context, MotionSample *sample);
ParcelStatus mock_light_read(void *context, LightProximitySample *sample);
ParcelStatus mock_environment_read(void *context, EnvironmentSample *sample);

#endif
