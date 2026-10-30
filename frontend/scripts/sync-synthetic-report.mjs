import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(frontendDir, "..");
const source = path.join(repoDir, "ml/models/synthetic/model.json");
const destination = path.join(frontendDir, "public/samples/synthetic-evaluation.json");

const report = JSON.parse(await readFile(source, "utf8"));
if (report.data_origin !== "synthetic") {
  throw new Error("Refusing to publish the bundled example: its data_origin must be synthetic.");
}
await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log("Synced synthetic-tagged evaluation report into the Field Desk assets.");
