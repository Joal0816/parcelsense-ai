#include "hardware/sensors.h"
#include <math.h>
#include <stddef.h>

ParcelStatus motion_sample_validate(const MotionSample *sample)
{
    if (sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    if (sample->status != PARCEL_STATUS_OK) return sample->status;
    if (!sample->valid) return PARCEL_STATUS_INVALID_DATA;
    for (unsigned i = 0; i < 3U; ++i) {
        if (!isfinite(sample->acceleration_m_s2[i]) ||
            !isfinite(sample->angular_velocity_rad_s[i])) {
            return PARCEL_STATUS_INVALID_DATA;
        }
    }
    return PARCEL_STATUS_OK;
}

ParcelStatus light_proximity_sample_validate(const LightProximitySample *sample)
{
    if (sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    if (sample->status != PARCEL_STATUS_OK) return sample->status;
    if (!sample->valid || !isfinite(sample->ambient_illuminance_lux) ||
        sample->ambient_illuminance_lux < 0.0f) {
        return PARCEL_STATUS_INVALID_DATA;
    }
    return PARCEL_STATUS_OK;
}

ParcelStatus environment_sample_validate(const EnvironmentSample *sample)
{
    if (sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    if (sample->status != PARCEL_STATUS_OK) return sample->status;
    if (!sample->valid || !isfinite(sample->temperature_celsius) ||
        !isfinite(sample->relative_humidity_percent) ||
        sample->relative_humidity_percent < 0.0f ||
        sample->relative_humidity_percent > 100.0f) {
        return PARCEL_STATUS_INVALID_DATA;
    }
    return PARCEL_STATUS_OK;
}

ParcelStatus imu_read_sample(const ImuInterface *interface, MotionSample *sample)
{
    if (interface == NULL || sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *sample = (MotionSample){.status = PARCEL_STATUS_NOT_INITIALIZED};
    if (interface->read == NULL) return PARCEL_STATUS_NOT_INITIALIZED;
    ParcelStatus status = interface->read(interface->context, sample);
    if (status != PARCEL_STATUS_OK) {
        sample->valid = false;
        sample->status = status;
        return status;
    }
    status = motion_sample_validate(sample);
    if (status != PARCEL_STATUS_OK) {
        sample->valid = false;
        sample->status = status;
    }
    return status;
}

ParcelStatus light_proximity_read_sample(const LightProximityInterface *interface,
                                         LightProximitySample *sample)
{
    if (interface == NULL || sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *sample = (LightProximitySample){.status = PARCEL_STATUS_NOT_INITIALIZED};
    if (interface->read == NULL) return PARCEL_STATUS_NOT_INITIALIZED;
    ParcelStatus status = interface->read(interface->context, sample);
    if (status != PARCEL_STATUS_OK) {
        sample->valid = false;
        sample->status = status;
        return status;
    }
    status = light_proximity_sample_validate(sample);
    if (status != PARCEL_STATUS_OK) {
        sample->valid = false;
        sample->status = status;
    }
    return status;
}

ParcelStatus environment_read_sample(const EnvironmentInterface *interface,
                                     EnvironmentSample *sample)
{
    if (interface == NULL || sample == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *sample = (EnvironmentSample){.status = PARCEL_STATUS_NOT_INITIALIZED};
    if (interface->read == NULL) return PARCEL_STATUS_NOT_INITIALIZED;
    ParcelStatus status = interface->read(interface->context, sample);
    if (status != PARCEL_STATUS_OK) {
        sample->valid = false;
        sample->status = status;
        return status;
    }
    status = environment_sample_validate(sample);
    if (status != PARCEL_STATUS_OK) {
        sample->valid = false;
        sample->status = status;
    }
    return status;
}
