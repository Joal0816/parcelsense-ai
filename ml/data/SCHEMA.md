# Motion dataset CSV schema

The Phase 4 pipeline consumes UTF-8 CSV with one sample per row. The first row must contain these exact required column names (column order is flexible):

| Field | Required | Meaning |
|---|---:|---|
| `schema_version` | yes | Must be `1.0`. |
| `session_id` | yes | Opaque identifier for one recording session. |
| `trial_id` | yes | Opaque identifier unique within the session; a trial has one label. |
| `timestamp_ms` | yes | Monotonic unsigned 32-bit millisecond timestamp; wraparound is supported. |
| `accel_x_m_s2`, `accel_y_m_s2`, `accel_z_m_s2` | yes | Acceleration in m/s². |
| `gyro_x_rad_s`, `gyro_y_rad_s`, `gyro_z_rad_s` | yes | Angular velocity in rad/s. |
| `valid` | yes | `true`/`false` or `1`/`0`. False samples break windows and are excluded. |
| `status` | yes | `ok` for a usable sample; other values are excluded. |
| `label` | yes | Exactly `Stable`, `Normal Handling`, or `Rough Handling`. |
| `ambient_illuminance_lux`, `proximity_counts`, `temperature_celsius`, `relative_humidity_percent` | no | Optional context values. Blank or invalid context is excluded from context use, but does not invalidate motion data. |

The pipeline rejects non-finite motion values, malformed timestamps, invalid flags/status, unsupported schema versions, unknown labels, and conflicting labels within one trial. Rejected motion rows break a segment so a window cannot bridge a sensor fault. Incomplete windows are listed in `exclusions.csv`. Dataset splits keep every `(session_id, trial_id)` group intact.

Illustrative header and row (documentation example only; **not measured data**):

```csv
schema_version,session_id,trial_id,timestamp_ms,accel_x_m_s2,accel_y_m_s2,accel_z_m_s2,gyro_x_rad_s,gyro_y_rad_s,gyro_z_rad_s,valid,status,label,ambient_illuminance_lux,proximity_counts,temperature_celsius,relative_humidity_percent
1.0,SESSION_PLACEHOLDER,TRIAL_PLACEHOLDER,0,0.0,0.0,9.81,0.0,0.0,0.0,true,ok,Stable,,,,
```

Use opaque IDs and avoid names or other identifying details. Raw recordings may contain sensitive context and are ignored by Git by default. Review privacy, consent, and instructor requirements before retaining or sharing real data.
