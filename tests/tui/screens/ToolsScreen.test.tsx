/**
 * ToolsScreen Tests
 */

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "../setup.js";
import {
  mockConfigService,
  mockTestingService,
  sampleLocalServers,
  waitForStateUpdate,
  KEYS,
} from "../setup.js";

// Setup mocks before importing component
vi.mock("../../../src/services/config.service.js", () => ({
  getConfigService: vi.fn(() => mockConfigService),
}));

vi.mock("../../../src/services/testing.service.js", () => ({
  getTestingService: vi.fn(() => mockTestingService),
}));

import { ToolsScreen } from "../../../src/tui/screens/ToolsScreen.js";

describe("ToolsScreen", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.getLocalServers.mockReturnValue([]);
    mockConfigService.getRemoteServers.mockReturnValue([]);
  });

  describe("Rendering - No Server Selected", () => {
    it("should render global token view title", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("Token Usage");
    });

    it("should show empty global state when no servers", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} />);

      expect(lastFrame()).toContain("No servers configured");
    });
  });

  describe("Rendering - With Server Selected", () => {
    beforeEach(() => {
      mockConfigService.getLocalServers.mockReturnValue(sampleLocalServers);
      mockConfigService.getToolFilters.mockReturnValue({
        server1: {
          allTools: ["tool1", "tool2", "tool3"],
          disabledTools: ["tool3"],
        },
      });
    });

    it("should display server name in title when server is selected", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      expect(lastFrame()).toContain("Server One");
    });

    it("should show tools list when server has tools", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      expect(lastFrame()).toContain("tool1");
      expect(lastFrame()).toContain("tool2");
      expect(lastFrame()).toContain("tool3");
    });
  });

  describe("Navigation", () => {
    it("should call onBack when Q is pressed", () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} />);

      stdin.write("q");

      expect(mockOnBack).toHaveBeenCalled();
    });

    it("should call onBack when ESC is pressed", async () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} />);

      stdin.write(KEYS.ESCAPE);

      await vi.waitFor(() => expect(mockOnBack).toHaveBeenCalled());
    });

    it("should navigate between tools with arrow keys", async () => {
      mockConfigService.getLocalServers.mockReturnValue(sampleLocalServers);
      mockConfigService.getToolFilters.mockReturnValue({
        server1: {
          allTools: ["tool1", "tool2", "tool3"],
          disabledTools: [],
        },
      });

      const { stdin, lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      const initialFrame = lastFrame();
      expect(initialFrame).toContain("→");

      stdin.write(KEYS.DOWN);
      await waitForStateUpdate();

      expect(lastFrame()).toContain("→");
    });
  });

  describe("Tool Management", () => {
    beforeEach(() => {
      mockConfigService.getLocalServers.mockReturnValue(sampleLocalServers);
      mockConfigService.getToolFilters.mockReturnValue({
        server1: {
          allTools: ["tool1", "tool2", "tool3"],
          disabledTools: [],
        },
      });
    });

    it("should toggle tool with Space key", async () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      // Toggle first tool
      stdin.write(KEYS.SPACE);
      await waitForStateUpdate();

      expect(mockConfigService.toggleTool).toHaveBeenCalled();
    });

    it("should enable all tools with A key", async () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      // Enable all
      stdin.write("a");
      await waitForStateUpdate();

      expect(mockConfigService.enableAllTools).toHaveBeenCalled();
    });

    it("should disable all tools with N key", async () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      // Disable all
      stdin.write("n");
      await waitForStateUpdate();

      expect(mockConfigService.disableAllTools).toHaveBeenCalled();
    });
  });

  describe("Tool Annotations", () => {
    beforeEach(() => {
      mockConfigService.getLocalServers.mockReturnValue(sampleLocalServers);
      mockConfigService.getToolFilters.mockReturnValue({
        server1: {
          allTools: ["read_a", "read_b", "delete_a", "plain"],
          disabledTools: [],
          toolsData: {
            read_a: { tokens: 10, annotations: { readOnlyHint: true, idempotentHint: true } },
            read_b: { tokens: 10, annotations: { readOnlyHint: true } },
            delete_a: { tokens: 10, annotations: { destructiveHint: true } },
            plain: { tokens: 10 },
          },
        },
      });
    });

    it("should show badges next to annotated tools", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      const frame = lastFrame() ?? "";
      expect(frame).toContain("[read-only]");
      expect(frame).toContain("[destructive]");
      expect(frame).toContain("[idempotent]");
    });

    it("should show group rows with counts above the tools", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      const frame = lastFrame() ?? "";
      expect(frame).toContain("All read-only (2)");
      expect(frame).toContain("All destructive (1)");
    });

    it("should not show group rows when no tool has annotations", () => {
      mockConfigService.getToolFilters.mockReturnValue({
        server1: { allTools: ["plain"], disabledTools: [], toolsData: { plain: { tokens: 10 } } },
      });

      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      expect(lastFrame()).not.toContain("All read-only");
      expect(lastFrame()).not.toContain("All destructive");
    });

    it("should disable the whole group with Space when all of it is enabled", async () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      stdin.write(KEYS.SPACE);
      await waitForStateUpdate();

      expect(mockConfigService.setToolsEnabled).toHaveBeenCalledWith(
        "server1",
        ["read_a", "read_b"],
        false
      );
      expect(mockConfigService.toggleTool).not.toHaveBeenCalled();
    });

    it("should enable the whole group with Space when part of it is disabled", async () => {
      mockConfigService.getToolFilters.mockReturnValue({
        server1: {
          allTools: ["read_a", "read_b"],
          disabledTools: ["read_b"],
          toolsData: {
            read_a: { tokens: 10, annotations: { readOnlyHint: true } },
            read_b: { tokens: 10, annotations: { readOnlyHint: true } },
          },
        },
      });

      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      stdin.write(KEYS.SPACE);
      await waitForStateUpdate();

      expect(mockConfigService.setToolsEnabled).toHaveBeenCalledWith(
        "server1",
        ["read_a", "read_b"],
        true
      );
    });

    it("should toggle a single tool when Space is pressed on a tool row", async () => {
      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      stdin.write(KEYS.DOWN);
      await waitForStateUpdate();
      stdin.write(KEYS.DOWN);
      await waitForStateUpdate();
      stdin.write(KEYS.SPACE);
      await waitForStateUpdate();

      expect(mockConfigService.toggleTool).toHaveBeenCalledWith("server1", "read_a");
    });
  });

  describe("Rediscovery", () => {
    const unannotated = {
      server1: {
        allTools: ["read", "write"],
        disabledTools: [],
        toolsData: { read: { tokens: 10 }, write: { tokens: 10 } },
      },
    };
    const annotated = {
      server1: {
        allTools: ["read", "write"],
        disabledTools: [],
        toolsData: {
          read: { tokens: 10, annotations: { readOnlyHint: true } },
          write: { tokens: 10 },
        },
      },
    };

    beforeEach(() => {
      mockConfigService.getLocalServers.mockReturnValue(sampleLocalServers);
      mockConfigService.findServer.mockReturnValue({
        server: sampleLocalServers[0],
        type: "local",
      });
    });

    it("should keep the selected tool when rediscovery adds group rows", async () => {
      mockConfigService.getToolFilters.mockReturnValue(unannotated);
      mockTestingService.testServer.mockImplementationOnce(async () => {
        mockConfigService.getToolFilters.mockReturnValue(annotated);
        return { success: true, toolCount: 2 };
      });

      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      stdin.write(KEYS.DOWN);
      await waitForStateUpdate();
      stdin.write("x");
      await waitForStateUpdate();
      stdin.write(KEYS.SPACE);
      await waitForStateUpdate();

      expect(mockConfigService.toggleTool).toHaveBeenCalledWith("server1", "write");
    });

    it("should keep the selected tool when rediscovery removes group rows", async () => {
      mockConfigService.getToolFilters.mockReturnValue(annotated);
      mockTestingService.testServer.mockImplementationOnce(async () => {
        mockConfigService.getToolFilters.mockReturnValue(unannotated);
        return { success: true, toolCount: 2 };
      });

      const { stdin } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      stdin.write(KEYS.UP);
      await waitForStateUpdate();
      stdin.write("x");
      await waitForStateUpdate();
      stdin.write(KEYS.SPACE);
      await waitForStateUpdate();

      expect(mockConfigService.toggleTool).toHaveBeenCalledWith("server1", "write");
    });
  });

  describe("Help Text", () => {
    it("should display keyboard shortcuts", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} />);

      const frame = lastFrame();
      expect(frame).toMatch(/Q|Back/i);
    });
  });

  describe("No Tools Discovered", () => {
    beforeEach(() => {
      mockConfigService.getLocalServers.mockReturnValue(sampleLocalServers);
      mockConfigService.getToolFilters.mockReturnValue({
        server1: {
          allTools: [],
          disabledTools: [],
        },
      });
    });

    it("should show message when no tools discovered", () => {
      const { lastFrame } = render(<ToolsScreen onBack={mockOnBack} initialServerId="server1" />);

      expect(lastFrame()).toContain("No tools discovered");
    });
  });
});
