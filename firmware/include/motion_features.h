#ifndef PARCELSENSE_FEATURES_H
#define PARCELSENSE_FEATURES_H

#include <stddef.h>
#include "classifier.h"
#include "hardware/sensors.h"

/* Index order is the stable ABI in ml/scripts/pipeline.py: FEATURE_NAMES. */
typedef enum {
    PARCEL_FEATURE_MEAN_ACCEL_X_M_S2 = 0,
    PARCEL_FEATURE_MEAN_ACCEL_Y_M_S2,
    PARCEL_FEATURE_MEAN_ACCEL_Z_M_S2,
    PARCEL_FEATURE_MEAN_GYRO_X_RAD_S,
    PARCEL_FEATURE_MEAN_GYRO_Y_RAD_S,
    PARCEL_FEATURE_MEAN_GYRO_Z_RAD_S,
    PARCEL_FEATURE_STD_ACCEL_X_M_S2,
    PARCEL_FEATURE_STD_ACCEL_Y_M_S2,
    PARCEL_FEATURE_STD_ACCEL_Z_M_S2,
    PARCEL_FEATURE_STD_GYRO_X_RAD_S,
    PARCEL_FEATURE_STD_GYRO_Y_RAD_S,
    PARCEL_FEATURE_STD_GYRO_Z_RAD_S,
    PARCEL_FEATURE_RMS_ACCEL_X_M_S2,
    PARCEL_FEATURE_RMS_ACCEL_Y_M_S2,
    PARCEL_FEATURE_RMS_ACCEL_Z_M_S2,
    PARCEL_FEATURE_RMS_GYRO_X_RAD_S,
    PARCEL_FEATURE_RMS_GYRO_Y_RAD_S,
    PARCEL_FEATURE_RMS_GYRO_Z_RAD_S,
    PARCEL_FEATURE_ACCEL_NORM_MEAN,
    PARCEL_FEATURE_ACCEL_NORM_STD,
    PARCEL_FEATURE_ACCEL_NORM_RMS,
    PARCEL_FEATURE_ACCEL_NORM_MAX,
    PARCEL_FEATURE_GYRO_NORM_RMS,
    PARCEL_FEATURE_JERK_NORM_RMS
} ParcelSenseFeatureIndex;

/*
 * Extract the same 24 population-statistics features as the host pipeline.
 * Samples must be valid and ordered by uint32 millisecond timestamps. The
 * output is zeroed on failure; this function does not predict a class.
 */
ParcelStatus parcelsense_extract_features(const MotionSample *samples,
                                          size_t sample_count,
                                          float features[PARCELSENSE_FEATURE_COUNT]);

#endif
