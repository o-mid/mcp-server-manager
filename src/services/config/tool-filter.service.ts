import type { Result, ServerToolFilter, ToolFilters } from "../../types/index.js";
import { ConfigRepository } from "./config.repository.js";

export class ToolFilterService {
  constructor(private readonly repository: ConfigRepository) {}

  getToolFilters(): ToolFilters {
    return this.repository.getToolFilters();
  }

  getServerToolFilter(serverId: string): ServerToolFilter | undefined {
    return this.repository.getToolFilters()[serverId];
  }

  setServerToolFilter(serverId: string, filter: ServerToolFilter): void {
    this.repository.updateToolFilters((filters) => {
      filters[serverId] = filter;
    });
  }

  removeFilter(filterId: string): void {
    this.repository.updateToolFilters((filters) => {
      delete filters[filterId];
    });
  }

  toggleTool(filterId: string, toolName: string): void {
    this.repository.updateToolFilters((filters) => {
      const filter = filters[filterId];
      if (!filter) return;

      const disabledTools = new Set(filter.disabledTools || []);
      if (disabledTools.has(toolName)) {
        disabledTools.delete(toolName);
      } else {
        disabledTools.add(toolName);
      }

      filter.disabledTools = Array.from(disabledTools);
    });
  }

  enableTool(filterId: string, toolName: string): void {
    this.repository.updateToolFilters((filters) => {
      const filter = filters[filterId];
      if (!filter) return;

      const disabledTools = new Set(filter.disabledTools || []);
      disabledTools.delete(toolName);
      filter.disabledTools = Array.from(disabledTools);
    });
  }

  disableTool(filterId: string, toolName: string): void {
    this.repository.updateToolFilters((filters) => {
      const filter = filters[filterId];
      if (!filter) return;

      const disabledTools = new Set(filter.disabledTools || []);
      disabledTools.add(toolName);
      filter.disabledTools = Array.from(disabledTools);
    });
  }

  setToolsEnabled(filterId: string, toolNames: string[], enabled: boolean): void {
    this.repository.updateToolFilters((filters) => {
      const filter = filters[filterId];
      if (!filter) return;

      const disabledTools = new Set(filter.disabledTools || []);
      for (const toolName of toolNames) {
        if (enabled) {
          disabledTools.delete(toolName);
        } else {
          disabledTools.add(toolName);
        }
      }

      filter.disabledTools = Array.from(disabledTools);
    });
  }

  enableAllTools(filterId: string): void {
    this.repository.updateToolFilters((filters) => {
      const filter = filters[filterId];
      if (!filter) return;
      filter.disabledTools = [];
    });
  }

  disableAllTools(filterId: string): void {
    this.repository.updateToolFilters((filters) => {
      const filter = filters[filterId];
      if (!filter) return;
      filter.disabledTools = [...(filter.allTools || [])];
    });
  }

  resetToolFilters(filterId: string): Result {
    const filter = this.repository.getToolFilters()[filterId];
    if (!filter) {
      return { success: false, error: `No tool filter found for '${filterId}'` };
    }

    this.repository.updateToolFilters((filters) => {
      const existing = filters[filterId];
      if (existing) {
        existing.disabledTools = [];
      }
    });

    return { success: true };
  }

  isToolEnabled(filterId: string, toolName: string): boolean {
    const filter = this.repository.getToolFilters()[filterId];
    if (!filter) return true;

    return !filter.disabledTools?.includes(toolName);
  }

  getEnabledTools(filterId: string): string[] {
    const filter = this.repository.getToolFilters()[filterId];
    if (!filter) return [];

    const allTools = filter.allTools || [];
    const disabledTools = new Set(filter.disabledTools || []);
    return allTools.filter((t) => !disabledTools.has(t));
  }

  getDisabledTools(filterId: string): string[] {
    const filter = this.repository.getToolFilters()[filterId];
    if (!filter) return [];
    return filter.disabledTools || [];
  }
}
