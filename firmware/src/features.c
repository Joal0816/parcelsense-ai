#include "motion_features.h"

#include <float.h>
#include <math.h>
#include <stdint.h>

enum { CHANNEL_COUNT = 6U };
_Static_assert(PARCEL_FEATURE_JERK_NORM_RMS + 1U == PARCELSENSE_FEATURE_COUNT,
               "feature indices must match the 24-value model ABI");

static bool float_representable(double value)
{
    return isfinite(value) && value <= (double)FLT_MAX &&
           value >= -(double)FLT_MAX;
}

static void zero_features(float features[PARCELSENSE_FEATURE_COUNT])
{
    for (size_t i = 0U; i < PARCELSENSE_FEATURE_COUNT; ++i) features[i] = 0.0f;
}

ParcelStatus parcelsense_extract_features(const MotionSample *samples,
                                          size_t sample_count,
                                          float features[PARCELSENSE_FEATURE_COUNT])
{
    if (features == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    zero_features(features);
    if (samples == NULL || sample_count == 0U) return PARCEL_STATUS_INVALID_ARGUMENT;

    double sums[CHANNEL_COUNT] = {0.0};
    double sum_squares[CHANNEL_COUNT] = {0.0};
    double accel_norm_sum = 0.0;
    double accel_norm_sum_squares = 0.0;
    double accel_norm_max = 0.0;
    double gyro_norm_sum_squares = 0.0;

    for (size_t i = 0U; i < sample_count; ++i) {
        const ParcelStatus status = motion_sample_validate(&samples[i]);
        if (status != PARCEL_STATUS_OK) return status;
        if (i > 0U) {
            const uint32_t delta_ms = samples[i].timestamp_ms - samples[i - 1U].timestamp_ms;
            if (delta_ms == 0U || delta_ms >= UINT32_C(0x80000000)) {
                return PARCEL_STATUS_INVALID_DATA;
            }
        }

        double accel_norm_squared = 0.0;
        double gyro_norm_squared = 0.0;
        for (size_t axis = 0U; axis < 3U; ++axis) {
            const double acceleration = (double)samples[i].acceleration_m_s2[axis];
            const double angular_velocity = (double)samples[i].angular_velocity_rad_s[axis];
            const size_t accel_channel = axis;
            const size_t gyro_channel = axis + 3U;
            sums[accel_channel] += acceleration;
            sum_squares[accel_channel] += acceleration * acceleration;
            sums[gyro_channel] += angular_velocity;
            sum_squares[gyro_channel] += angular_velocity * angular_velocity;
            accel_norm_squared += acceleration * acceleration;
            gyro_norm_squared += angular_velocity * angular_velocity;
        }
        const double accel_norm = sqrt(accel_norm_squared);
        accel_norm_sum += accel_norm;
        accel_norm_sum_squares += accel_norm_squared;
        gyro_norm_sum_squares += gyro_norm_squared;
        if (accel_norm > accel_norm_max) accel_norm_max = accel_norm;
    }

    const double divisor = (double)sample_count;
    double means[CHANNEL_COUNT];
    for (size_t channel = 0U; channel < CHANNEL_COUNT; ++channel) {
        means[channel] = sums[channel] / divisor;
    }
    const double accel_norm_mean = accel_norm_sum / divisor;

    /* A second pass matches the host pipeline's centered population variance. */
    double centered_squares[CHANNEL_COUNT] = {0.0};
    double accel_norm_centered_squares = 0.0;
    for (size_t i = 0U; i < sample_count; ++i) {
        double accel_norm_squared = 0.0;
        for (size_t axis = 0U; axis < 3U; ++axis) {
            const double acceleration = (double)samples[i].acceleration_m_s2[axis];
            const double angular_velocity = (double)samples[i].angular_velocity_rad_s[axis];
            const double accel_delta = acceleration - means[axis];
            const double gyro_delta = angular_velocity - means[axis + 3U];
            centered_squares[axis] += accel_delta * accel_delta;
            centered_squares[axis + 3U] += gyro_delta * gyro_delta;
            accel_norm_squared += acceleration * acceleration;
        }
        const double norm_delta = sqrt(accel_norm_squared) - accel_norm_mean;
        accel_norm_centered_squares += norm_delta * norm_delta;
    }

    double jerk_norm_sum_squares = 0.0;
    if (sample_count > 1U) {
        for (size_t i = 1U; i < sample_count; ++i) {
            const uint32_t delta_ms = samples[i].timestamp_ms - samples[i - 1U].timestamp_ms;
            const double seconds = (double)delta_ms / 1000.0;
            double jerk_squared = 0.0;
            for (size_t axis = 0U; axis < 3U; ++axis) {
                const double delta = ((double)samples[i].acceleration_m_s2[axis] -
                                      (double)samples[i - 1U].acceleration_m_s2[axis]) /
                                     seconds;
                jerk_squared += delta * delta;
            }
            jerk_norm_sum_squares += jerk_squared;
        }
    }

    double values[PARCELSENSE_FEATURE_COUNT];
    for (size_t channel = 0U; channel < CHANNEL_COUNT; ++channel) {
        values[PARCEL_FEATURE_MEAN_ACCEL_X_M_S2 + channel] = means[channel];
        values[PARCEL_FEATURE_STD_ACCEL_X_M_S2 + channel] =
            sqrt(centered_squares[channel] / divisor);
        values[PARCEL_FEATURE_RMS_ACCEL_X_M_S2 + channel] =
            sqrt(sum_squares[channel] / divisor);
    }
    values[PARCEL_FEATURE_ACCEL_NORM_MEAN] = accel_norm_mean;
    values[PARCEL_FEATURE_ACCEL_NORM_STD] = sqrt(accel_norm_centered_squares / divisor);
    values[PARCEL_FEATURE_ACCEL_NORM_RMS] = sqrt(accel_norm_sum_squares / divisor);
    values[PARCEL_FEATURE_ACCEL_NORM_MAX] = accel_norm_max;
    values[PARCEL_FEATURE_GYRO_NORM_RMS] = sqrt(gyro_norm_sum_squares / divisor);
    values[PARCEL_FEATURE_JERK_NORM_RMS] = sample_count > 1U
        ? sqrt(jerk_norm_sum_squares / (double)(sample_count - 1U)) : 0.0;

    for (size_t i = 0U; i < PARCELSENSE_FEATURE_COUNT; ++i) {
        if (!float_representable(values[i])) return PARCEL_STATUS_INVALID_DATA;
    }
    for (size_t i = 0U; i < PARCELSENSE_FEATURE_COUNT; ++i) {
        features[i] = (float)values[i];
    }
    return PARCEL_STATUS_OK;
}
