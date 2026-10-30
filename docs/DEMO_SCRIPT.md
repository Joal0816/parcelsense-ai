# Software-only demonstration script

**Purpose:** demonstrate the file-review software while being explicit that no STM32 is connected. The bundled sample and separate pipeline dataset are generated software fixtures. They are not recordings or evidence of real parcel-handling performance.

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
3. **Show both modes (1 minute).** From **Overview**, choose **Try the synthetic demo**. Explain the acceleration-over-time graph and that the labels are supplied in the CSV, not model predictions. Review and save the sample. Open **Data sessions**, select **STM32 capture**, and show the CSV import path and the notice that live capture is unavailable. Do not declare an example file as a board recording unless it was actually captured on verified hardware.
4. **Review a session (1 minute).** Show the motion trace, label counts, validation log, and raw-row preview. The trace is generated acceleration data; the label counts come from the CSV. Neither is a classifier prediction.
5. **Show local persistence control (1 minute).** If demonstrating the optional API, select **Send reviewed copy**, then open **Settings & privacy** to show the local API copy. Delete the API copy and point out that this does not delete the browser copy. This optional database resides in the local `.local` directory.
6. **Show evaluation and hardware gates (1 minute).** From **Overview**, choose **Show model report**. Point out its **SYNTHETIC** provenance warning and explain that its perfect-looking metrics come from deliberately separated generated signals; they are only a pipeline demonstration. Then open **Device status** and show that hardware checks are unverified and live capture is disabled.
7. **Close with limitations (30 seconds).** State that actual data capture, module diagnostics, model evaluation on real held-out trials, on-board inference, timing, and reliability tests remain to be done with the board. If submitting without the board, show the disclaimer in [`SYNTHETIC_ONLY_REPORT.md`](SYNTHETIC_ONLY_REPORT.md) and ask the instructor whether this alternative is acceptable.

## Optional file import demonstration

Use a schema-conforming CSV supplied or approved for the demo, and identify its provenance before importing. If no approved recording exists, use the bundled synthetic fixture above. Do not label manually invented rows as sensor readings, and do not use synthetic values to report model accuracy.

## Stop

Stop local services with **Ctrl+C** in the terminal. Keep any recording outside the repository unless it has been reviewed for privacy and approved for retention. The local API database is not a backup.
