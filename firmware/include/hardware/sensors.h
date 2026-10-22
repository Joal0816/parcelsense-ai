#ifndef PARCELSENSE_HARDWARE_SENSORS_H
#define PARCELSENSE_HARDWARE_SENSORS_H

#include <stdbool.h>
#include <stdint.h>
#include "hardware/status.h"

typedef struct {
    uint32_t timestamp_ms;
    ParcelStatus status;
    bool valid;
    float acceleration_m_s2[3];
    float angular_velocity_rad_s[3];
} MotionSample;

typedef struct {
    uint32_t timestamp_ms;
    ParcelStatus status;
    bool valid;
    float ambient_illuminance_lux;
    uint16_t proximity_counts;
} LightProximitySample;

typedef struct {
    uint32_t timestamp_ms;
    ParcelStatus status;
    bool valid;
    float temperature_celsius;
    float relative_humidity_percent;
} EnvironmentSample;

typedef ParcelStatus (*SensorInitializeFn)(void *context);
typedef ParcelStatus (*SensorDiagnoseFn)(void *context);
typedef ParcelStatus (*MotionReadFn)(void *context, MotionSample *sample);
typedef ParcelStatus (*LightProximityReadFn)(void *context, LightProximitySample *sample);
typedef ParcelStatus (*EnvironmentReadFn)(void *context, EnvironmentSample *sample);

/* Implementations must be supplied by a separately verified hardware backend. */
typedef struct {
    void *context;
    SensorInitializeFn initialize;
    SensorDiagnoseFn diagnose;
    MotionReadFn read;
} ImuInterface;

typedef struct {
    void *context;
    SensorInitializeFn initialize;
    SensorDiagnoseFn diagnose;
    LightProximityReadFn read;
} LightProximityInterface;

typedef struct {
    void *context;
    SensorInitializeFn initialize;
    SensorDiagnoseFn diagnose;
    EnvironmentReadFn read;
} EnvironmentInterface;

typedef struct {
    ImuInterface icm20608;
    LightProximityInterface ap3216c;
    EnvironmentInterface aht10;
} SensorInterfaces;

ParcelStatus motion_sample_validate(const MotionSample *sample);
ParcelStatus light_proximity_sample_validate(const LightProximitySample *sample);
ParcelStatus environment_sample_validate(const EnvironmentSample *sample);
/* Wrappers zero outputs first and propagate callback or validation failures. */
ParcelStatus imu_read_sample(const ImuInterface *interface, MotionSample *sample);
ParcelStatus light_proximity_read_sample(const LightProximityInterface *interface,
                                         LightProximitySample *sample);
ParcelStatus environment_read_sample(const EnvironmentInterface *interface,
                                     EnvironmentSample *sample);

#endif
