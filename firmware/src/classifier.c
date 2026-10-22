#include <math.h>
#include "classifier.h"

ParcelStatus parcelsense_classify_features(ParcelModelPredictFn predict,
                                           const float *features,
                                           size_t count,
                                           UiClassification *classification)
{
    if (classification == NULL) return PARCEL_STATUS_INVALID_ARGUMENT;
    *classification = UI_STATE_UNAVAILABLE;

    if (predict == NULL) return PARCEL_STATUS_NOT_INITIALIZED;
    if (features == NULL || count != PARCELSENSE_FEATURE_COUNT) {
        return PARCEL_STATUS_INVALID_ARGUMENT;
    }
    for (size_t index = 0; index < count; ++index) {
        if (!isfinite(features[index])) return PARCEL_STATUS_INVALID_DATA;
    }

    const int prediction = predict(features, count);
    switch (prediction) {
    case 0:
        *classification = UI_STATE_STABLE;
        return PARCEL_STATUS_OK;
    case 1:
        *classification = UI_STATE_NORMAL_HANDLING;
        return PARCEL_STATUS_OK;
    case 2:
        *classification = UI_STATE_ROUGH_HANDLING;
        return PARCEL_STATUS_OK;
    default:
        return PARCEL_STATUS_INVALID_DATA;
    }
}
