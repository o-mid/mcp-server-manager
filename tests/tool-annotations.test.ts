import { describe, expect, it } from "vitest";
import { getToolBadges, getToolKind, getToolNamesByKind } from "../src/shared/toolAnnotations.js";
import type { ServerToolFilter } from "../src/types/index.js";

describe("getToolKind", () => {
  it("classifies read-only tools", () => {
    expect(getToolKind({ readOnlyHint: true })).toBe("read-only");
  });

  it("prefers read-only over destructive when both are set", () => {
    expect(getToolKind({ readOnlyHint: true, destructiveHint: true })).toBe("read-only");
  });

  it("classifies tools that explicitly declare destructive", () => {
    expect(getToolKind({ readOnlyHint: false, destructiveHint: true })).toBe("destructive");
    expect(getToolKind({ destructiveHint: true })).toBe("destructive");
  });

  it("leaves tools without a clear declaration unclassified", () => {
    expect(getToolKind(undefined)).toBe("unclassified");
    expect(getToolKind({})).toBe("unclassified");
    expect(getToolKind({ readOnlyHint: false })).toBe("unclassified");
    expect(getToolKind({ readOnlyHint: false, destructiveHint: false })).toBe("unclassified");
    expect(getToolKind({ idempotentHint: true })).toBe("unclassified");
  });
});

describe("getToolBadges", () => {
  it("returns no badges for unclassified tools", () => {
    expect(getToolBadges(undefined)).toEqual([]);
  });

  it("returns kind and idempotent badges in order", () => {
    expect(getToolBadges({ destructiveHint: true, idempotentHint: true })).toEqual([
      "destructive",
      "idempotent",
    ]);
  });

  it("returns idempotent alone when the kind is unclassified", () => {
    expect(getToolBadges({ idempotentHint: true })).toEqual(["idempotent"]);
  });
});

describe("getToolNamesByKind", () => {
  const filter: ServerToolFilter = {
    allTools: ["read", "delete", "write", "unknown"],
    toolsData: {
      read: { tokens: 1, annotations: { readOnlyHint: true } },
      delete: { tokens: 1, annotations: { destructiveHint: true } },
      write: { tokens: 1, annotations: { readOnlyHint: false, destructiveHint: false } },
      unknown: { tokens: 1 },
    },
  };

  it("lists the tool names of each kind", () => {
    expect(getToolNamesByKind(filter, "read-only")).toEqual(["read"]);
    expect(getToolNamesByKind(filter, "destructive")).toEqual(["delete"]);
    expect(getToolNamesByKind(filter, "unclassified")).toEqual(["write", "unknown"]);
  });

  it("returns nothing when tools were discovered without annotation data", () => {
    expect(getToolNamesByKind({ allTools: ["a"] }, "read-only")).toEqual([]);
    expect(getToolNamesByKind({}, "read-only")).toEqual([]);
  });
});
