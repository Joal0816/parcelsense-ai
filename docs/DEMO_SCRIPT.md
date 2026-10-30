# Software-only demonstration script

**Purpose:** demonstrate the file-review software while being explicit that no STM32 is connected. The bundled synthetic sample is a generated software fixture. It is not a recording, trained-model evidence, or handling-performance result.

## Before the demonstration

For the hosted demo, open the [ParcelSense Field Desk](https://parcelsense.joalvergs.tech) in a browser. To demonstrate optional local API storage as well, install Node.js 22.12 or newer, npm, and Python 3, then run from the repository root:

```sh
cd frontend
npm ci
npm run dev:local
```

Open the loopback URL printed by the command, normally `http://127.0.0.1:5173`. The local API and browser app run on this computer. Do not expose the API to a network interface. The API is optional; the hosted app includes the synthetic demo fixture.

## Walkthrough (about 5 minutes)

1. **Set scope (30 seconds).** Say: “This demo covers the software workflow. The RT-Spark is unavailable, so device connection, sensor readings, and embedded inference are not being demonstrated.”
2. **Show Field desk (30 seconds).** Point out imported-session counts and the **Not connected** device state. Explain that hosted imports stay in this browser.
3. **Show both modes (1 minute).** Open **Data sessions**. Select **Synthetic demo**, choose **Load synthetic sample**, and inspect the CSV review dialog. Point out valid rows and its synthetic provenance, then save. Select **STM32 capture** and show the CSV import path and the notice that live capture is unavailable. Do not declare an example file as a board recording unless it was actually captured on verified hardware.
4. **Review a session (1 minute).** Open the saved session. Show the class distribution, validation log, preview, and the synthetic-data note. Clarify that the chart shows imported labels, not predictions.
5. **Show local persistence control (1 minute).** If demonstrating the optional API, select **Send reviewed copy**, then open **Settings & privacy** to show the local API copy. Delete the API copy and point out that this does not delete the browser copy. This optional database resides in the local `.local` directory.
6. **Show evaluation and hardware gates (1 minute).** Open **Evaluation review** and explain that no real-data report is available until a reviewed dataset is collected and processed. Open **Device status** and show that hardware checks are unverified and live capture is disabled.
7. **Close with limitations (30 seconds).** State that actual data capture, module diagnostics, model evaluation on real held-out trials, on-board inference, timing, and reliability tests remain to be done with the board.

## Optional file import demonstration

Use a schema-conforming CSV supplied or approved for the demo, and identify its provenance before importing. If no approved recording exists, use the bundled synthetic fixture above. Do not label manually invented rows as sensor readings, and do not use synthetic values to report model accuracy.

## Stop

Stop local services with **Ctrl+C** in the terminal. Keep any recording outside the repository unless it has been reviewed for privacy and approved for retention. The local API database is not a backup.
