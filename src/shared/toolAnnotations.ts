/**
 * Classification of MCP tool annotations (self-reported hints, no spec defaults applied)
 */

import type { ServerToolFilter, ToolAnnotations } from "../types/index.js";

export type ToolKind = "read-only" | "destructive" | "unclassified";

export function getToolKind(annotations?: ToolAnnotations): ToolKind {
  if (annotations?.readOnlyHint === true) return "read-only";
  if (annotations?.destructiveHint === true) return "destructive";
  return "unclassified";
}

export function isIdempotent(annotations?: ToolAnnotations): boolean {
  return annotations?.idempotentHint === true;
}

/** Badge labels for a tool, in display order */
export function getToolBadges(annotations?: ToolAnnotations): string[] {
  const kind = getToolKind(annotations);
  const badges: string[] = kind === "unclassified" ? [] : [kind];
  if (isIdempotent(annotations)) badges.push("idempotent");
  return badges;
}

export function getToolNamesByKind(filter: ServerToolFilter, kind: ToolKind): string[] {
  return (filter.allTools || []).filter(
    (name) => getToolKind(filter.toolsData?.[name]?.annotations) === kind
  );
}
