import assert from "node:assert/strict";
import { test } from "node:test";
import { planActions } from "../src/actions.js";
import { renderPlanText, renderReportText, toJsonReport } from "../src/render.js";
import type { DuplicateGroup, PhysicalFile } from "../src/types.js";

const ANSI_ESCAPE_CHARACTER = String.fromCharCode(27);

function physicalFile(overrides: Partial<PhysicalFile>): PhysicalFile {
  return { paths: ["/a"], sizeBytes: 10, device: 1, inode: 1, modifiedAtMs: 0, ...overrides };
}

const EMPTY_REPORT = { groups: [] as DuplicateGroup[], filesScanned: 0, bytesScanned: 0, warnings: [] };

void test("renderReportText: reports no duplicates found for an empty report", () => {
  const text = renderReportText(EMPTY_REPORT, false);
  assert.match(text, /No duplicate files found/);
});

void test("renderReportText: lists every path in every group", () => {
  const group: DuplicateGroup = {
    hash: "abc",
    sizeBytes: 100,
    files: [physicalFile({ paths: ["/a.txt"] }), physicalFile({ paths: ["/b.txt"] })],
  };
  const text = renderReportText({ groups: [group], filesScanned: 2, bytesScanned: 200, warnings: [] }, false);

  assert.match(text, /\/a\.txt/);
  assert.match(text, /\/b\.txt/);
  assert.match(text, /2 copies/);
  assert.match(text, /100 B/);
});

void test("renderReportText: never emits raw ANSI escapes when colors are disabled", () => {
  const group: DuplicateGroup = { hash: "abc", sizeBytes: 5, files: [physicalFile({}), physicalFile({})] };
  const text = renderReportText({ groups: [group], filesScanned: 2, bytesScanned: 10, warnings: [] }, false);
  assert.equal(text.includes(ANSI_ESCAPE_CHARACTER), false);
});

void test("renderReportText: emits ANSI escapes when colors are enabled", () => {
  const text = renderReportText(EMPTY_REPORT, true);
  assert.equal(text.includes(ANSI_ESCAPE_CHARACTER), true);
});

void test("renderReportText: surfaces warnings with their path and message", () => {
  const report = {
    groups: [] as DuplicateGroup[],
    filesScanned: 0,
    bytesScanned: 0,
    warnings: [{ path: "/no-access", message: "EACCES" }],
  };
  const text = renderReportText(report, false);
  assert.match(text, /\/no-access/);
  assert.match(text, /EACCES/);
});

void test("renderPlanText: shows the kept file and every removed path with the given verb", () => {
  const group: DuplicateGroup = {
    hash: "abc",
    sizeBytes: 50,
    files: [
      physicalFile({ paths: ["/keep.txt"], modifiedAtMs: 1 }),
      physicalFile({ paths: ["/remove.txt"], modifiedAtMs: 2 }),
    ],
  };
  const [action] = planActions([group], "oldest");
  assert.ok(action);

  const text = renderPlanText([action], "delete", false);
  assert.match(text, /keep {3}\/keep\.txt/);
  assert.match(text, /delete \/remove\.txt/);
  assert.match(text, /50 B/);
});

void test("toJsonReport: serializes groups with reclaimable bytes and ISO timestamps", () => {
  const group: DuplicateGroup = {
    hash: "abc",
    sizeBytes: 10,
    files: [
      physicalFile({ paths: ["/a"], modifiedAtMs: 0 }),
      physicalFile({ paths: ["/b"], modifiedAtMs: 0 }),
    ],
  };
  const json = toJsonReport({ groups: [group], filesScanned: 2, bytesScanned: 20, warnings: [] }) as {
    groups: { reclaimableBytes: number; files: { modifiedAt: string }[] }[];
  };

  const [firstGroup] = json.groups;
  assert.ok(firstGroup);
  assert.equal(firstGroup.reclaimableBytes, 10);
  const [firstFile] = firstGroup.files;
  assert.ok(firstFile);
  assert.equal(firstFile.modifiedAt, new Date(0).toISOString());
});
