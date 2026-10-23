import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { stripVTControlCharacters as stripAnsi } from "util";

const CLI = "node bin/cli.js";
vi.setConfig({ testTimeout: process.platform === "win32" ? 20000 : 10000 });

describe("CLI tools enable/disable share one filter state", () => {
  let testConfigDir: string;
  let filtersPath: string;

  beforeEach(() => {
    testConfigDir = path.join(os.tmpdir(), `mcpsm-cli-tools-${Date.now()}-${Math.random()}`);
    filtersPath = path.join(testConfigDir, "tool-filters.json");

    fs.mkdirSync(testConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(testConfigDir, "config.json"),
      JSON.stringify({
        servers: [{ id: "demo", name: "demo", command: "node", args: ["server.js"] }],
        remoteServers: [],
        port: 8850,
      })
    );
    fs.writeFileSync(
      filtersPath,
      JSON.stringify({
        demo: {
          allTools: ["read", "delete"],
          enabled: ["read", "delete"],
          disabledTools: [],
          toolsData: {
            read: { tokens: 10, annotations: { readOnlyHint: true } },
            delete: { tokens: 10, annotations: { destructiveHint: true } },
          },
        },
      })
    );
  });

  afterEach(() => {
    fs.rmSync(testConfigDir, { recursive: true, force: true });
  });

  const run = (args: string): string =>
    execSync(`${CLI} ${args}`, {
      cwd: process.cwd(),
      env: { ...process.env, MCP_MANAGER_CONFIG_DIR: testConfigDir },
      stdio: "pipe",
    }).toString();

  const readDisabledTools = (): string[] =>
    JSON.parse(fs.readFileSync(filtersPath, "utf8")).demo.disabledTools;

  const toolStatus = (name: string): string | undefined =>
    stripAnsi(run("tools list demo --all"))
      .split("\n")
      .find((line) => line.includes(` ${name}`))
      ?.match(/- (enabled|disabled)/)?.[1];

  it("re-enables a single tool after its group was disabled", () => {
    run("tools disable demo --destructive");
    expect(readDisabledTools()).toEqual(["delete"]);

    const output = run("tools enable demo delete");

    expect(output).not.toContain("already enabled");
    expect(readDisabledTools()).toEqual([]);
    expect(toolStatus("delete")).toBe("enabled");
  });

  it("re-enables everything after a group was disabled", () => {
    run("tools disable demo --destructive");

    run("tools enable demo --all");

    expect(readDisabledTools()).toEqual([]);
    expect(toolStatus("read")).toBe("enabled");
    expect(toolStatus("delete")).toBe("enabled");
  });

  it("disables a single tool in the same state the gateway reads", () => {
    run("tools disable demo delete");

    expect(readDisabledTools()).toEqual(["delete"]);
    expect(toolStatus("delete")).toBe("disabled");
  });

  it("disables all tools in the same state the gateway reads", () => {
    run("tools disable demo --all");

    expect(readDisabledTools()).toEqual(["read", "delete"]);
  });

  it("counts enabled tools in the summary from the same state", () => {
    run("tools disable demo --destructive");

    expect(stripAnsi(run("tools list"))).toContain("demo - 1/2 enabled");
  });

  it("prints tool kinds and enabled state as JSON for a server", () => {
    run("tools disable demo --destructive");

    const output = JSON.parse(run("tools list demo --all --json"));

    expect(output.tools).toEqual([
      expect.objectContaining({ name: "read", enabled: true, kind: "read-only" }),
      expect.objectContaining({ name: "delete", enabled: false, kind: "destructive" }),
    ]);
  });

  it("prints enabled counts as JSON in the servers summary", () => {
    run("tools disable demo --destructive");

    const output = JSON.parse(run("tools list --json"));

    expect(output.servers).toEqual([
      expect.objectContaining({ id: "demo", toolCount: 2, enabledCount: 1 }),
    ]);
  });
});
