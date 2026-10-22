/* HOST TEST ONLY: deterministic fixtures, not production hardware. */
#include "mock_hardware.h"

ParcelStatus mock_module_probe(void *context, ModuleId id)
{
    MockHardware *mock = context;
    if (mock == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    mock->probe_calls++;
    mock->last_module = id;
    return mock->probe_result;
}

ParcelStatus mock_motion_read(void *context, MotionSample *sample)
{
    MockHardware *mock = context;
    if (mock == NULL || sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *sample = mock->motion_fixture;
    return sample->status;
}

ParcelStatus mock_light_read(void *context, LightProximitySample *sample)
{
    MockHardware *mock = context;
    if (mock == NULL || sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *sample = mock->light_fixture;
    return sample->status;
}

ParcelStatus mock_environment_read(void *context, EnvironmentSample *sample)
{
    MockHardware *mock = context;
    if (mock == NULL || sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *sample = mock->environment_fixture;
    return sample->status;
}
