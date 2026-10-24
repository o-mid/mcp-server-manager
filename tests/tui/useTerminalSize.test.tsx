import React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { cleanup, render } from "ink-testing-library";

const mockStdout = new (class extends EventEmitter {
  columns: number | undefined = 80;
  rows: number | undefined = 24;
  isTTY = true;
  write() {
    return true;
  }
})();

vi.mock("ink", async () => {
  const actual = await vi.importActual<typeof import("ink")>("ink");
  return {
    ...actual,
    useStdout: () => ({ stdout: mockStdout }),
  };
});

import { Text } from "ink";
import { useTerminalSize } from "../../src/tui/hooks/useTerminalSize.js";

function TestComponent(): React.ReactElement {
  const { columns, rows } = useTerminalSize();
  return <Text>{`${columns}x${rows}`}</Text>;
}

describe("useTerminalSize", () => {
  beforeEach(() => {
    mockStdout.columns = 80;
    mockStdout.rows = 24;
  });

  afterEach(cleanup);

  it("updates when stdout emits resize", async () => {
    const { lastFrame, unmount } = render(<TestComponent />);
    await vi.waitFor(() => expect(lastFrame()).toContain("80x24"));

    mockStdout.columns = 120;
    mockStdout.rows = 40;
    mockStdout.emit("resize");

    await vi.waitFor(() => expect(lastFrame()).toContain("120x40"));
    unmount();
    await vi.waitFor(() => expect(mockStdout.listenerCount("resize")).toBe(0));
  });

  it.each([undefined, 0])(
    "uses fallback dimensions when stream dimensions are %s",
    async (size) => {
      mockStdout.columns = size;
      mockStdout.rows = size;
      const { lastFrame } = render(<TestComponent />);
      await vi.waitFor(() => expect(lastFrame()).toContain("60x20"));
    }
  );
});
