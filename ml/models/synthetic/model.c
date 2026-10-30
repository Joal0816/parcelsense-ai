/* Generated from the training split; see adjacent model.json. */
#include <math.h>
#include <stddef.h>
#include <stdint.h>
typedef struct { int16_t feature, left, right; int8_t label; float threshold; } Node;
static const Node nodes[] = {
    {6, 1, 2, -1, 0.0716751472},
    {-1, -1, -1, 0, 0},
    {6, 3, 4, -1, 0.482567016},
    {-1, -1, -1, 1, 0},
    {-1, -1, -1, 2, 0},
};
int parcelsense_predict(const float *features, size_t count) {
    if (features == NULL || count != 24U) return -1;
    for (size_t i = 0; i < count; ++i) if (!isfinite(features[i])) return -1;
    int index = 0;
    for (size_t step = 0; step < sizeof(nodes) / sizeof(nodes[0]); ++step) {
        if (index < 0 || (size_t)index >= sizeof(nodes) / sizeof(nodes[0])) return -1;
        const Node *node = &nodes[index];
        if (node->label >= 0) return node->label;
        if (node->feature < 0 || (size_t)node->feature >= count) return -1;
        index = features[node->feature] <= node->threshold ? node->left : node->right;
    }
    return -1;
}
