#ifndef PARCELSENSE_CLASSIFIER_H
#define PARCELSENSE_CLASSIFIER_H

#include <stddef.h>
#include "hardware/status.h"
#include "hardware/ui.h"

#define PARCELSENSE_FEATURE_COUNT 24U

/* ABI matches the C model exporter in ml/scripts/pipeline.py. */
typedef int (*ParcelModelPredictFn)(const float *features, size_t count);

/* The output is always unavailable on failure; model indices follow the
 * documented order: Stable, Normal Handling, Rough Handling. */
ParcelStatus parcelsense_classify_features(ParcelModelPredictFn predict,
                                           const float *features,
                                           size_t count,
                                           UiClassification *classification);

#endif
