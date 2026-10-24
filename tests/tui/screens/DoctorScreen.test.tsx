/**
 * DoctorScreen Tests
 */

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "../setup.js";
import { mockConfigService, waitForStateUpdate, KEYS } from "../setup.js";

// Setup mocks before importing component
vi.mock("../../../src/services/config.service.js", () => ({
  getConfigService: vi.fn(() => mockConfigService),
}));

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes("which")) {
      return "/usr/bin/node";
    }
    if (cmd.includes("--version")) {
      if (cmd.includes("python")) return "Python 3.11.0";
      if (cmd.includes("node")) return "v20.0.0";
      if (cmd.includes("npm")) return "10.0.0";
      if (cmd.includes("uv")) return "uv 0.1.0";
      return "1.0.0";
    }
    return "";
  }),
}));

// Mock fs
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
  existsSync: vi.fn(() => true),
}));

import { DoctorScreen } from "../../../src/tui/screens/DoctorScreen.js";

describe("DoctorScreen", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render doctor screen with title", () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("System Health Check");
    });

    it("should show loading indicator initially", () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      // Should show either spinner or loading text
      expect(lastFrame()).toMatch(/Running|check|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/i);
    });

    it("should display health check results", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await vi.waitFor(() => expect(lastFrame()).toContain("Node.js"));
    });

    it("should show Node.js version", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toMatch(/v\d+\.\d+\.\d+|node/i);
    });

    it("should show Python status", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toContain("Python");
    });

    it("should show npm status", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toContain("npm");
    });

    it("should show config directory status", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toContain("Config");
    });

    it("should show servers count", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toMatch(/Servers|configured/i);
    });
  });

  describe("Navigation", () => {
    it("should call onBack when any key is pressed after loading", async () => {
      const { stdin } = render(<DoctorScreen onBack={mockOnBack} />);

      // Wait for async health checks
      await waitForStateUpdate(200);

      stdin.write(KEYS.SPACE);

      expect(mockOnBack).toHaveBeenCalled();
    });

    it("should not call onBack while still loading", () => {
      const { stdin } = render(<DoctorScreen onBack={mockOnBack} />);

      // Press key immediately while loading
      stdin.write(KEYS.SPACE);

      // Should not have called onBack yet
      expect(mockOnBack).not.toHaveBeenCalled();
    });
  });

  describe("Health Check Results", () => {
    it("should show checkmark for passing checks", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toContain("✓");
    });

    it("should show summary at the end", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toMatch(/All checks passed|passed|failed/i);
    });

    it("should show press any key message after loading", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toMatch(/Any.*Go back|Go back/i);
    });
  });

  describe("Optional Tools", () => {
    it("should show uv as optional", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toContain("uv");
    });

    it("should show uvx status", async () => {
      const { lastFrame } = render(<DoctorScreen onBack={mockOnBack} />);

      await waitForStateUpdate(200);

      expect(lastFrame()).toContain("uvx");
    });
  });
});
