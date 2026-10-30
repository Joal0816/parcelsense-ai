#include "inference.h"

#include "motion_features.h"

ParcelStatus parcelsense_infer_window(const MotionSample *samples,
                                      size_t sample_count,
                                      ParcelModelPredictFn predict,
                                      UiClassification *classification)
{
    if (classification == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *classification = UI_STATE_UNAVAILABLE;

    float features[PARCELSENSE_FEATURE_COUNT];
    const ParcelStatus status = parcelsense_extract_features(samples, sample_count, features);
    if (status != PARCEL_STATUS_OK) return status;

    return parcelsense_classify_features(predict, features,
                                         PARCELSENSE_FEATURE_COUNT, classification);
}
