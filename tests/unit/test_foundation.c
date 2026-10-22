#include <assert.h>
#include <math.h>
#include <stdio.h>
#include "classifier.h"
#include "foundation.h"
#include "log_buffer.h"
#include "hardware/module_diagnostics.h"
#include "hardware/sensors.h"
#include "mock_hardware.h"

static int model_fixture_result;
static unsigned model_fixture_calls;

/* Deterministic ABI fixture only; it is not a trained ParcelSense model. */
static int model_fixture_predict(const float *features, size_t count)
{
    assert(features != NULL && count == PARCELSENSE_FEATURE_COUNT);
    model_fixture_calls++;
    return model_fixture_result;
}

int main(void)
{
    float feature_fixture[PARCELSENSE_FEATURE_COUNT] = {0};
    UiClassification classification = UI_STATE_ROUGH_HANDLING;
    const UiClassification expected_states[] = {
        UI_STATE_STABLE, UI_STATE_NORMAL_HANDLING, UI_STATE_ROUGH_HANDLING
    };
    for (int label = 0; label < 3; ++label) {
        model_fixture_result = label;
        assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
                   PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_OK);
        assert(classification == expected_states[label]);
    }
    assert(model_fixture_calls == 3U);

    classification = UI_STATE_ROUGH_HANDLING;
    assert(parcelsense_classify_features(NULL, feature_fixture,
               PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_NOT_INITIALIZED);
    assert(classification == UI_STATE_UNAVAILABLE);
    assert(parcelsense_classify_features(model_fixture_predict, NULL,
               PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_INVALID_ARGUMENT);
    assert(classification == UI_STATE_UNAVAILABLE);
    assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
               PARCELSENSE_FEATURE_COUNT - 1U, &classification) == PARCEL_STATUS_INVALID_ARGUMENT);
    assert(classification == UI_STATE_UNAVAILABLE);
    feature_fixture[7] = NAN;
    assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
               PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_INVALID_DATA);
    feature_fixture[7] = INFINITY;
    assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
               PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_INVALID_DATA);
    feature_fixture[7] = 0.0f;
    assert(model_fixture_calls == 3U); /* Invalid inputs never reach the model. */
    model_fixture_result = -1;
    assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
               PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_INVALID_DATA);
    assert(classification == UI_STATE_UNAVAILABLE);
    model_fixture_result = 3;
    assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
               PARCELSENSE_FEATURE_COUNT, &classification) == PARCEL_STATUS_INVALID_DATA);
    assert(classification == UI_STATE_UNAVAILABLE);
    assert(parcelsense_classify_features(model_fixture_predict, feature_fixture,
               PARCELSENSE_FEATURE_COUNT, NULL) == PARCEL_STATUS_INVALID_ARGUMENT);

    for (unsigned valid = 0; valid < 2; valid++) {
        SensorHeartbeat heartbeat = {UINT32_MAX, 123U, valid != 0};
        FoundationResult result = foundation_placeholder_result(heartbeat);
        assert(result.sequence == heartbeat.sequence && result.tick == heartbeat.tick);
        assert(!result.classification_valid && result.state == HANDLING_UNAVAILABLE);
    }
    LogBuffer buffer = {0};
    LogRecord record = {0};
    assert(!log_buffer_pop(&buffer, &record));
    /* Overflow, overwrite accounting, FIFO order and wrap-around. */
    for (uint32_t i = 0; i < 3U * LOG_BUFFER_CAPACITY; i++) {
        log_buffer_push(&buffer, (LogRecord){i, 7U, i + 1U});
    }
    assert(buffer.count == LOG_BUFFER_CAPACITY);
    assert(buffer.overwritten == 2U * LOG_BUFFER_CAPACITY);
    for (uint32_t i = 2U * LOG_BUFFER_CAPACITY; i < 3U * LOG_BUFFER_CAPACITY; i++) {
        assert(log_buffer_pop(&buffer, &record));
        assert(record.tick == i && record.event == 7U && record.value == i + 1U);
    }
    assert(!log_buffer_pop(&buffer, &record));
    log_buffer_push(&buffer, (LogRecord){42U, 1U, 99U});
    assert(log_buffer_pop(&buffer, &record) && record.value == 99U);

    MotionSample motion = {
        .timestamp_ms = 77U, .status = PARCEL_STATUS_OK, .valid = true,
        .acceleration_m_s2 = {0.0f, 0.0f, 9.81f},
        .angular_velocity_rad_s = {0.0f, 0.0f, 0.0f}
    };
    LightProximitySample light = {0U, PARCEL_STATUS_OK, true, 12.5f, 200U};
    EnvironmentSample environment = {0U, PARCEL_STATUS_OK, true, 22.0f, 50.0f};
    MockHardware mock = {
        .probe_result = PARCEL_STATUS_BUS_ERROR,
        .motion_fixture = motion,
        .light_fixture = light,
        .environment_fixture = environment
    };
    MotionSample readback = {0};
    ImuInterface imu_interface = {.context = &mock, .read = mock_motion_read};
    assert(imu_read_sample(&imu_interface, &readback) == PARCEL_STATUS_OK);
    assert(readback.timestamp_ms == 77U && motion_sample_validate(&readback) == PARCEL_STATUS_OK);
    mock.motion_fixture.acceleration_m_s2[0] = NAN;
    assert(imu_read_sample(&imu_interface, &readback) == PARCEL_STATUS_INVALID_DATA);
    assert(!readback.valid && readback.status == PARCEL_STATUS_INVALID_DATA);
    mock.motion_fixture = motion;
    mock.motion_fixture.status = PARCEL_STATUS_UNAVAILABLE;
    mock.motion_fixture.valid = false;
    assert(imu_read_sample(&imu_interface, &readback) == PARCEL_STATUS_UNAVAILABLE);
    assert(motion_sample_validate(NULL) == PARCEL_STATUS_INVALID_ARGUMENT);
    MotionSample untouched = {0};
    ImuInterface unbound_imu = {0};
    assert(imu_read_sample(&unbound_imu, &untouched) == PARCEL_STATUS_NOT_INITIALIZED);
    assert(!untouched.valid && untouched.status == PARCEL_STATUS_NOT_INITIALIZED);

    LightProximitySample light_readback;
    LightProximityInterface light_interface = {.context = &mock, .read = mock_light_read};
    assert(light_proximity_read_sample(&light_interface, &light_readback) == PARCEL_STATUS_OK);
    assert(light_readback.proximity_counts == 200U);
    mock.light_fixture.ambient_illuminance_lux = -1.0f;
    assert(light_proximity_read_sample(&light_interface, &light_readback) == PARCEL_STATUS_INVALID_DATA);
    EnvironmentSample environment_readback;
    EnvironmentInterface environment_interface = {.context = &mock, .read = mock_environment_read};
    assert(environment_read_sample(&environment_interface, &environment_readback) == PARCEL_STATUS_OK);
    mock.environment_fixture.relative_humidity_percent = 101.0f;
    assert(environment_read_sample(&environment_interface, &environment_readback) == PARCEL_STATUS_INVALID_DATA);

    ModuleDiagnosticRegistry registry;
    module_diagnostics_init(&registry);
    assert(registry.count == MODULE_DIAGNOSTIC_CAPACITY);
    module_diagnostics_run(&registry, mock_module_probe, &mock, 100U);
    assert(mock.probe_calls == 0U); /* UNVERIFIED entries must never touch a bus. */
    for (size_t i = 0; i < registry.count; i++) {
        assert(registry.entries[i].presence == MODULE_PRESENCE_UNVERIFIED);
        assert(registry.entries[i].health == MODULE_HEALTH_UNVERIFIED);
        assert(registry.entries[i].last_status == PARCEL_STATUS_UNVERIFIED);
    }
    assert(module_diagnostics_set_presence(&registry, MODULE_ICM20608_IMU,
                                           MODULE_PRESENCE_PRESENT) == PARCEL_STATUS_OK);
    module_diagnostics_run(&registry, NULL, NULL, 150U);
    assert(module_diagnostics_get(&registry, MODULE_ICM20608_IMU)->health == MODULE_HEALTH_NOT_PROBED);
    assert(module_diagnostics_get(&registry, MODULE_ICM20608_IMU)->last_status == PARCEL_STATUS_NOT_INITIALIZED);
    module_diagnostics_run(&registry, mock_module_probe, &mock, 200U);
    const ModuleDiagnostic *imu = module_diagnostics_get(&registry, MODULE_ICM20608_IMU);
    assert(mock.probe_calls == 1U && mock.last_module == MODULE_ICM20608_IMU);
    assert(imu->health == MODULE_HEALTH_FAULT && imu->last_status == PARCEL_STATUS_BUS_ERROR);
    assert(imu->failed_probes == 1U && imu->last_check_ms == 200U);
    mock.probe_result = PARCEL_STATUS_OK;
    module_diagnostics_run(&registry, mock_module_probe, &mock, 300U);
    imu = module_diagnostics_get(&registry, MODULE_ICM20608_IMU);
    assert(imu->health == MODULE_HEALTH_READY && imu->successful_probes == 1U);
    assert(module_diagnostics_set_presence(&registry, MODULE_AP3216C_LIGHT_PROXIMITY,
                                           MODULE_PRESENCE_ABSENT) == PARCEL_STATUS_OK);
    assert(module_diagnostics_set_presence(&registry, MODULE_AHT10_ENVIRONMENT,
                                           (ModulePresence)99) == PARCEL_STATUS_INVALID_ARGUMENT);
    module_diagnostics_run(&registry, NULL, NULL, 400U);
    assert(module_diagnostics_get(&registry, MODULE_AP3216C_LIGHT_PROXIMITY)->health == MODULE_HEALTH_ABSENT);
    assert(module_diagnostics_get(&registry, MODULE_AHT10_ENVIRONMENT)->health == MODULE_HEALTH_UNVERIFIED);

    puts("PASS: classifier adapter, sensor validation, safe unverified inventory, module faults, and log buffer");
    return 0;
}
