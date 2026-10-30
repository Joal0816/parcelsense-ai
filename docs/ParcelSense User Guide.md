# ParcelSense Field Desk User Guide

This guide explains how to use the ParcelSense Field Desk to review motion CSV files and pipeline evaluation reports. The Field Desk is a companion for data review. It does not connect to an STM32, record sensor data, or run the handling classifier.

## Quick start

1. Open the [ParcelSense Field Desk](https://parcelsense.joalvergs.tech) in a modern browser while online.
2. Choose **Import CSV** or open **Data sessions** and browse for a CSV file.
3. Review the validation summary. Save the reviewed import to keep its valid rows and validation notes in this browser.
4. Open the saved session to inspect label counts, issues, and a preview of the first rows. Export a copy if you need an archive.

The hosted app has no server-side record store. Imported CSV data and evaluation reports remain in the browser profile where you opened the app.

## What each section does

- **Field desk**: workspace summary, recent import, device status, and a shortcut to evaluation reports.
- **Data sessions**: import CSV files, review saved imports, inspect validation, export rows, and delete imports.
- **Evaluation review**: load and inspect a pipeline `model.json` report.
- **Device status**: see which hardware checks are pending. Live capture is disabled until the physical board and interface are verified.
- **Settings & privacy**: inspect browser storage estimates, request persistent browser storage, and delete local project data. In local development, it also shows the optional API status and its stored copies.

## Import and review a CSV

### CSV requirements

Choose a UTF-8 CSV using schema version `1.0`. Column order is flexible, but the header must include all of these fields:

| Column | Expected value |
| --- | --- |
| `schema_version` | `1.0` |
| `session_id`, `trial_id` | Non-empty, preferably opaque IDs without personal information. Each trial should have one label. |
| `timestamp_ms` | Unsigned 32-bit integer milliseconds, increasing within a trial. |
| `accel_x_m_s2`, `accel_y_m_s2`, `accel_z_m_s2` | Finite acceleration numbers in m/s². |
| `gyro_x_rad_s`, `gyro_y_rad_s`, `gyro_z_rad_s` | Finite angular-velocity numbers in rad/s. |
| `valid` | `true`, `false`, `1`, or `0`. False rows are excluded. |
| `status` | `ok` for a usable sample. Other values are excluded. |
| `label` | Exactly `Stable`, `Normal Handling`, or `Rough Handling`. |

Optional context columns are `ambient_illuminance_lux`, `proximity_counts`, `temperature_celsius`, and `relative_humidity_percent`. They are not required to review motion data. See the [full CSV schema](../ml/data/SCHEMA.md) for an illustrative header and row; that example is documentation only, not a sensor reading.

The current file-size limit is 25 MiB. Keep the original file separately. The app does not modify it.

### Import steps

1. In **Field desk** or **Data sessions**, select **Import CSV** or **Browse files**. You can also drop a CSV into the import area.
2. Wait for the background import to finish. Large files show progress; select **Cancel** to stop without changing the source file.
3. Read the review dialog. It shows valid rows, excluded rows, validation notes, and a small sample preview.
4. Select **Save reviewed import** to save the accepted rows and review notes in this browser. Rows with errors are excluded from the saved motion samples. If the file has a fatal problem, correct it and import again.
5. Select the saved file under **Data sessions** to see its summary and row preview.

Common reasons rows are excluded include unsupported schema versions, missing IDs, malformed timestamps, non-numeric motion values, `valid=false`, a status other than `ok`, an unknown label, conflicting labels in one trial, duplicate timestamps, or timestamps that move backward.

### Inspect and export a session

The detail view shows valid and excluded row counts, the imported label distribution, validation notes, and the first eight accepted rows. The label chart describes the labels in the file; it is not a classifier prediction.

- **Exact values** exports accepted rows while preserving their imported cell text.
- **Spreadsheet-safe** exports those rows with formula-like text protected for spreadsheet use.

Exports do not change the stored import. The app's session export contains accepted rows; keep the original CSV if you need excluded source rows or the complete original file. Use the delete icon on a session to remove its browser copy. Deletion cannot be undone.

## Use the two data modes

Both modes are available from **Data sessions** in the same web app. Choose a mode with the radio controls near the top of the page.

### Synthetic demo

Select **Synthetic demo**, then **Load synthetic sample**. The app includes a deterministic 1,200-row CSV fixture, so this works on the hosted app and after the PWA has been cached for offline use. Review and save it through the normal CSV flow. The saved import is marked synthetic.

These generated values are only for exercising import and review. They are not sensor readings, a parcel-handling result, or evidence of classifier accuracy. Do not use them to claim model performance.

### STM32 capture

Select **STM32 capture**, then **Import STM32 CSV** or drop a compatible CSV into the import area. The app checks the ParcelSense schema and reviews the file, but this mode is a file import only: live device connection, recording, and serial transfer are not implemented. Use a CSV exported by a capture process you have separately verified.

Before saving, confirm the declaration that the file was recorded using an STM32 board. The app then marks it **STM32 declared · unverified**. This records the operator's declaration; the app cannot identify the device or verify the sensors, units, labeling, or capture process. CSVs imported from Overview remain marked with unknown provenance; use STM32 mode to declare a board capture.

### Optional local API

The browser app remains usable without the API. For local SQLite copies, install Node.js 22.12 or newer, npm, and Python 3. From the project root, run:

```sh
cd frontend
npm ci
npm run dev:local
```

Open the local URL printed by the command (normally <http://127.0.0.1:5173>). In a session detail, **Send reviewed copy** copies accepted rows to `.local/parcelsense.sqlite3` on this computer; it does not transmit data to the hosted app. The API is bound to loopback. Stop both local services with **Ctrl+C**.

## Review a pipeline evaluation report

The **Evaluation review** page accepts a pipeline `model.json` file. Select **Load report**, choose the JSON report, and review the model type, label and feature order, data counts, held-out metrics, confusion matrix, split details, and displayed data provenance. Reports are saved in this browser and can be removed with the delete control next to the selected report.

Treat provenance and metrics carefully. A report marked `synthetic` is explicitly synthetic. A report marked `real_board` only declares that provenance; the Field Desk does not independently verify it. If provenance is missing, the app shows it as unknown. Metrics from generated or unknown-origin data do not establish real device performance.

## Use while offline and protect your records

- Open the hosted app once while online and allow it to finish loading. After the app shell is cached, the interface can reopen offline. The first visit requires a network connection.
- Imports and reports are stored in browser IndexedDB for that browser profile. They are not encrypted, synchronized, or backed up. Clearing site data, using a different browser/device, or browser storage eviction can remove them.
- Keep the original CSV and export copies you need elsewhere. In **Settings & privacy**, **Ask browser to keep storage** is only a best-effort request; it is not a backup.
- **Delete all local data** removes all Field Desk imports, samples, and evaluation reports from the current browser. Export anything you need first. This does not delete separate original files.
- The app does not collect telemetry. On the hosted site, there is no backend destination for imported records.

## Hardware status and the next step

The **Device status** page currently reports the RT-Spark / STM32F407ZGT6 target as unverified. Sensor population, pin mapping, communication interface, and firmware link have not been confirmed against a physical board. The Field Desk can review an existing compatible CSV without the board, but it cannot create a live capture, command the board, or read sensor values.

When the board is available, verify its revision and sensors, establish the safe sampling and labeling protocol, then implement and validate the firmware data output and a supported transfer path. Import board-generated CSV only after checking the actual field units and format against the [schema](../ml/data/SCHEMA.md). Until real board data has been collected and evaluated, do not present synthetic data or pipeline smoke-test metrics as device results.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| A CSV is rejected before review | Confirm it is a UTF-8 CSV with unique headers and every required column. Check that `schema_version` is `1.0`. |
| Many rows are excluded | Read the validation notes and correct IDs, timestamps, numeric motion values, validity/status fields, labels, or trial label conflicts in a copy of the source. Then import the corrected file. |
| **Load synthetic sample** is missing or unavailable | It is bundled with the app. Reconnect and reload if its offline copy has not been cached yet. |
| **Send reviewed copy** is disabled | This is available only in local development while the API is running, and only when the import has valid rows. |
| Imported files are missing | Check the same browser profile and device used for import. Browser storage is local and may be cleared or evicted. Restore by importing the original CSV again. |
| The app will not open offline | Reconnect and open the hosted app once, wait for it to finish loading, then try offline again. |
| Device status says no device is connected | This is expected until a physical board and a verified communication path are implemented. CSV review still works independently. |

## Related project documentation

- [CSV schema](../ml/data/SCHEMA.md)
- [Local API instructions](../backend/README.md)
- [Offline ML pipeline guide](ML_PIPELINE.md)
- [Hardware arrival checklist](BOARD_ARRIVAL_CHECKLIST.md)
- [PWA deployment and offline behavior](PWA_DEPLOYMENT.md)
