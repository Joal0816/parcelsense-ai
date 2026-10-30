#ifndef PARCELSENSE_INFERENCE_H
#define PARCELSENSE_INFERENCE_H

#include <stddef.h>
#include "classifier.h"
#include "hardware/sensors.h"

/* Host-testable sample-window → feature vector → model callback path. */
ParcelStatus parcelsense_infer_window(const MotionSample *samples,
                                      size_t sample_count,
                                      ParcelModelPredictFn predict,
                                      UiClassification *classification);

#endif
