import React from "react";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "../setup.js";
import { mockConfigService, mockDaemonService, waitForStateUpdate, KEYS } from "../setup.js";

// Setup mocks before importing component
vi.mock("../../../src/services/daemon.service.js", () => ({
  getDaemonService: vi.fn(() => mockDaemonService),
}));

import { DaemonScreen } from "../../../src/tui/screens/DaemonScreen.js";

describe("DaemonScreen", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render daemon screen with title", () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("Daemon Management");
    });

    it("should display daemon status", () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("Status");
    });

    it("should display port information", async () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      await waitForStateUpdate();

      expect(lastFrame()).toContain("Port");
      expect(lastFrame()).toContain("8850");
    });

    it("should display menu options", () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("Start Daemon");
      expect(lastFrame()).toContain("Stop Daemon");
      expect(lastFrame()).toContain("View Logs");
    });

    it("should show startup status", () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      // Should show startup-related option
      expect(lastFrame()).toMatch(/startup|Startup|Enable|Disable/i);
    });

    it("should display compact status summary", () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("Status:");
      expect(lastFrame()).toContain("Auto-start");
    });
  });

  describe("Navigation", () => {
    it("should call onBack when Q is pressed", () => {
      const { stdin } = render(<DaemonScreen onBack={mockOnBack} />);

      stdin.write("q");

      expect(mockOnBack).toHaveBeenCalled();
    });

    it("should call onBack when ESC is pressed", async () => {
      const { stdin } = render(<DaemonScreen onBack={mockOnBack} />);

      stdin.write(KEYS.ESCAPE);

      await vi.waitFor(() => expect(mockOnBack).toHaveBeenCalled());
    });

    it("should navigate between options with arrow keys", async () => {
      const { stdin, lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      const initialFrame = lastFrame();
      expect(initialFrame).toContain("→");

      stdin.write(KEYS.DOWN);
      await waitForStateUpdate();

      expect(lastFrame()).toContain("→");
    });
  });

  describe("Daemon Actions", () => {
    it("should try to start daemon when Start option is selected", async () => {
      const { stdin } = render(<DaemonScreen onBack={mockOnBack} />);

      // Select "Start Daemon" (first option)
      stdin.write(KEYS.ENTER);
      await waitForStateUpdate();

      // Should have called startDaemon
      expect(mockDaemonService.startDaemon).toHaveBeenCalled();
    });

    it("refreshes daemon when Refresh is selected", async () => {
      const { stdin } = render(<DaemonScreen onBack={mockOnBack} />);

      stdin.write(KEYS.DOWN);
      await waitForStateUpdate();
      stdin.write(KEYS.ENTER);
      await waitForStateUpdate();

      expect(mockDaemonService.refreshDaemon).toHaveBeenCalled();
    });

    it("clears logs when Clear Logs is selected", async () => {
      const logPath = path.join(os.tmpdir(), "daemon-clear.log");
      mockDaemonService.getLogFilePath.mockReturnValue(logPath);
      fs.writeFileSync(logPath, "old logs");

      const { stdin, lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);
      for (let i = 0; i < 4; i++) {
        stdin.write(KEYS.DOWN);
        await waitForStateUpdate();
      }
      stdin.write(KEYS.ENTER);
      await waitForStateUpdate(300);

      expect(lastFrame()).toContain("Logs cleared");
      expect(fs.readFileSync(logPath, "utf8")).toBe("");
    });
  });

  describe("Startup Management", () => {
    it("should toggle startup when Enable/Disable Startup is selected", async () => {
      const { stdin } = render(<DaemonScreen onBack={mockOnBack} />);

      // Navigate to startup option (Enable Auto-start is later in the list)
      for (let i = 0; i < 5; i++) {
        stdin.write(KEYS.DOWN);
        await waitForStateUpdate();
      }

      stdin.write(KEYS.ENTER);
      await waitForStateUpdate();

      // Should have called enableStartup (since startupEnabled is false in mock)
      expect(mockDaemonService.enableStartup).toHaveBeenCalled();
    });
  });

  describe("Status Display", () => {
    it("should show 'stopped' when daemon is not running", async () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      await waitForStateUpdate();

      expect(lastFrame()).toMatch(/stopped/i);
    });

    it("should show 'healthy' when daemon is running and responding", async () => {
      // Update mock to return running state
      mockDaemonService.getStatus.mockResolvedValueOnce({
        running: true,
        pid: 12345,
        port: 8850,
        startupEnabled: false,
        logFile: path.join(os.tmpdir(), "daemon.log"),
        healthy: true,
        health: { status: "ok", servers: 2, tools: 5 },
      });

      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      await waitForStateUpdate();

      expect(lastFrame()).toMatch(/healthy/i);
    });
  });

  describe("Help Text", () => {
    it("should display keyboard shortcuts", () => {
      const { lastFrame } = render(<DaemonScreen onBack={mockOnBack} />);

      const frame = lastFrame();
      expect(frame).toMatch(/ENTER|Select/i);
      expect(frame).toMatch(/Q|Back/i);
    });
  });
});
