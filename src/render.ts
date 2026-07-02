import type { FindDuplicatesResult } from "./dedupe.js";
import { createColors, formatBytes } from "./format.js";
import { primaryPath } from "./physical-file.js";
import type { PlannedAction } from "./types.js";

export function renderReportText(report: FindDuplicatesResult, colorsEnabled: boolean): string {
  const c = createColors(colorsEnabled);
  const lines: string[] = [];

  if (report.groups.length === 0) {
    lines.push(`${c.green}No duplicate files found.${c.reset}`);
  } else {
    for (const [index, group] of report.groups.entries()) {
      const wastedBytes = group.sizeBytes * (group.files.length - 1);
      lines.push(
        `${c.bold}#${index + 1}${c.reset} ${c.cyan}${formatBytes(group.sizeBytes)}${c.reset} each ` +
          `× ${group.files.length} copies ${c.yellow}(${formatBytes(wastedBytes)} reclaimable)${c.reset}`,
      );
      for (const file of group.files) {
        for (const filePath of file.paths) {
          lines.push(`    ${c.dim}${filePath}${c.reset}`);
        }
      }
    }
  }

  const totalReclaimable = report.groups.reduce(
    (sum, group) => sum + group.sizeBytes * (group.files.length - 1),
    0,
  );

  lines.push("");
  lines.push(
    `${c.bold}Summary:${c.reset} scanned ${report.filesScanned} files (${formatBytes(report.bytesScanned)}), ` +
      `found ${report.groups.length} duplicate group(s), ${c.yellow}${formatBytes(totalReclaimable)} reclaimable${c.reset}.`,
  );

  if (report.warnings.length > 0) {
    lines.push(`${c.red}${report.warnings.length} path(s) could not be read:${c.reset}`);
    for (const warning of report.warnings) {
      lines.push(`    ${c.dim}${warning.path}: ${warning.message}${c.reset}`);
    }
  }

  return lines.join("\n");
}

export function renderPlanText(
  actions: readonly PlannedAction[],
  verb: "delete" | "hardlink",
  colorsEnabled: boolean,
): string {
  const c = createColors(colorsEnabled);
  const lines: string[] = [];
  const totalReclaimable = actions.reduce((sum, action) => sum + action.reclaimableBytes, 0);

  for (const action of actions) {
    const keptPath = primaryPath(action.keep);
    lines.push(`${c.green}keep${c.reset}   ${keptPath}`);
    for (const file of action.remove) {
      for (const filePath of file.paths) {
        lines.push(`${c.red}${verb}${c.reset} ${filePath}`);
      }
    }
  }

  lines.push("");
  lines.push(
    `${c.bold}This will free ${c.yellow}${formatBytes(totalReclaimable)}${c.reset}${c.bold} across ${actions.length} group(s).${c.reset}`,
  );

  return lines.join("\n");
}

export function toJsonReport(report: FindDuplicatesResult): unknown {
  return {
    filesScanned: report.filesScanned,
    bytesScanned: report.bytesScanned,
    groups: report.groups.map((group) => ({
      hash: group.hash,
      sizeBytes: group.sizeBytes,
      reclaimableBytes: group.sizeBytes * (group.files.length - 1),
      files: group.files.map((file) => ({
        paths: file.paths,
        modifiedAt: new Date(file.modifiedAtMs).toISOString(),
      })),
    })),
    warnings: report.warnings,
  };
}
