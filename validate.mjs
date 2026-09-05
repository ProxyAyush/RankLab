import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const context = { window: {} };
vm.runInNewContext(readFileSync(join(root, "model-data.js"), "utf8"), context);
const model = context.window.NEETPG_MODEL_V2;

assert(model?.schemaVersion === 2, "Expected model schema v2");
assert(model.range.minMarks === 350 && model.range.maxMarks === 650, "Expected a 350–650 model range");
assert(model.records.length === 301, "Expected 301 one-mark records");
assert(model.records.every((record, index) => record.marks === 350 + index), "Model records are not contiguous");

for (const key of ["harder", "baseline", "mixed", "easier", "weighted"]) {
  assert(model.records.every((record) => Number.isFinite(record[key]) && record[key] >= 1), `${key} contains an invalid AIR`);
  assert(model.records.slice(1).every((record, index) => record[key] <= model.records[index][key]), `${key} is not monotonic`);
}

assert(model.records.every((record) => record.best === record.harder && record.worst === record.easier), "Scenario envelope mismatch");
assert(model.records.every((record) => Number.isFinite(record.weightedDensity) && record.weightedDensity >= 0), "Invalid weighted density");
assert(Math.abs(Object.values(model.scenarioWeights).reduce((sum, value) => sum + value, 0) - 1) < 1e-9, "Scenario weights must sum to one");

const at508 = model.records[508 - model.range.minMarks];
assert(at508.weighted === 9825, "508 weighted AIR changed");
assert(at508.baseline === 9644, "508 baseline AIR changed");
assert(at508.harder === 5541 && at508.easier === 15660, "508 scenario envelope changed");
assert(at508.weightedDensity === 244, "508 density changed");

const userCaseTotal = model.userCase.correct + model.userCase.wrong + model.userCase.unattempted;
const oneMoreCorrect = (model.userCase.correct + 1) * 4 - (model.userCase.wrong - 1);
const oneFewerCorrect = (model.userCase.correct - 1) * 4 - (model.userCase.wrong + 1);
assert(userCaseTotal === model.exam.questions, "Default answer breakdown does not total 180");
assert(oneMoreCorrect === model.userCase.marks + 5, "Wrong-to-correct step must add five marks");
assert(oneFewerCorrect === model.userCase.marks - 5, "Correct-to-wrong step must remove five marks");

const htmlFiles = ["index.html", "feedback.html", "privacy.html", "terms.html"];
for (const filename of htmlFiles) {
  const html = readFileSync(join(root, filename), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert(new Set(ids).size === ids.length, `${filename} contains duplicate IDs`);
  assert(html.includes('name="robots"'), `${filename} is missing crawler directives`);

  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const localPath = target.split(/[?#]/)[0];
    assert(existsSync(join(root, localPath)), `${filename} has a missing local asset: ${target}`);
  }
}

const index = readFileSync(join(root, "index.html"), "utf8");
assert(index.includes('min="350" max="650"'), "Predictor inputs do not expose the new range");
assert(index.includes("Pre-result research model"), "Prominent pre-result disclaimer is missing");
assert(index.includes("https://razorpay.me/@docayushyadav"), "Razorpay support link is missing");
assert(["weighted", "harder", "baseline", "mixed", "easier"].every((key) => index.includes(`data-lens="${key}"`)), "Scenario controls are incomplete");
assert(["answerCalcOpen", "scoreCalculatorDialog", "correctAnswers", "wrongAnswers", "unattemptedAnswers", "recallScoreDock", "recallScoreEdit"].every((id) => index.includes(`id="${id}"`)), "Answer calculator UI is incomplete");
assert(["tableSummaryKicker", "tableSummaryText", "tableModeNote", "scoreTableHead", "scoreTable"].every((id) => index.includes(`id="${id}"`)), "Question neighbourhood UI is incomplete");
assert(index.includes('data-table-mode="questions"') && index.includes('data-table-mode="marks"'), "Question and raw-mark table modes are missing");

const app = readFileSync(join(root, "app.js"), "utf8");
assert(app.includes("correct * 4 - wrong"), "NEET-PG +4/−1 score formula is missing");
assert(app.includes("state.total < model.questions") && app.includes("state.total > model.questions"), "180-question validation is incomplete");
assert(app.includes("state.marks < model.minMarks || state.marks > model.maxMarks"), "Calculator does not guard the predictor range");
assert(!/fetch\s*\([^)]*(?:correct|wrong|unattempted)/i.test(app), "Answer recall must remain device-local");
assert(app.includes("state.correct + correctDelta") && app.includes("state.wrong - correctDelta"), "Wrong-to-correct question scenarios are missing");
assert(app.includes('tableMode = "questions"'), "Question neighbourhood is not the default table view");

const feedback = readFileSync(join(root, "feedback.html"), "utf8");
assert(!/<form[^>]+action=/i.test(feedback), "Feedback form must not submit to a server");
assert(readFileSync(join(root, "pages.js"), "utf8").includes("mailto:"), "Feedback email handoff is missing");

const robots = readFileSync(join(root, "robots.txt"), "utf8");
assert(/User-agent:\s*\*/i.test(robots) && /Disallow:\s*\//i.test(robots), "robots.txt is not strict");

for (const filename of [...htmlFiles, "styles.css", "app.js", "pages.js", "model-data.js", "manifest.webmanifest", "sw.js", "robots.txt", "LICENSE.txt", ".nojekyll"]) {
  assert(existsSync(join(root, "dist", filename)), `Build output is missing ${basename(filename)}`);
}

console.log("Validated model v2, static routes, local assets, privacy flow, and crawler policy.");
