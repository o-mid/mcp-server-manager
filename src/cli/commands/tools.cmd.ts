/**
 * Tools commands - list, discover, enable, disable
 */

import { Command } from "commander";
import { colors, c } from "../../shared/colors.js";
import { formatTokens, outputJson } from "../../shared/formatters.js";
import { getToolBadges, getToolKind, getToolNamesByKind } from "../../shared/toolAnnotations.js";
import type { ServerToolFilter } from "../../types/index.js";
import { getConfigService } from "../../services/config.service.js";
import { getTestingService } from "../../services/testing.service.js";
import { getDaemonService } from "../../services/daemon.service.js";

async function refreshDaemonIfRunning(): Promise<void> {
  const daemonService = getDaemonService();
  const status = daemonService.isDaemonRunning();
  if (status.running) {
    await daemonService.refreshTools();
  }
}

/** Tool names for the --read-only/--destructive flags, or null when neither flag is set */
function getGroupToolNames(
  filter: ServerToolFilter,
  options: { readOnly?: boolean; destructive?: boolean }
): string[] | null {
  if (!options.readOnly && !options.destructive) return null;

  return [
    ...(options.readOnly ? getToolNamesByKind(filter, "read-only") : []),
    ...(options.destructive ? getToolNamesByKind(filter, "destructive") : []),
  ];
}

/** Register tools commands */
export function registerToolsCommands(program: Command): void {
  const tools = program.command("tools").description("Manage server tools");

  // List tools (default)
  tools
    .command("list [server]", { isDefault: true })
    .description("List tools for a server or all servers")
    .option("--json", "Output in JSON format")
    .option("-a, --all", "Show disabled tools too")
    .action(async (serverNameOrId: string | undefined, options) => {
      const configService = getConfigService();
      const toolFilters = configService.getToolFilters();

      if (serverNameOrId) {
        // Show tools for specific server
        const result = configService.findServer(serverNameOrId);
        if (!result) {
          console.log(`${c.cross} Server '${serverNameOrId}' not found`);
          process.exit(1);
        }

        const { server, type } = result;
        const filterId = configService.getFilterId(server.id, type);
        const filter = toolFilters[filterId];

        if (!filter || !filter.allTools || filter.allTools.length === 0) {
          console.log(
            `${colors.yellow}No tools discovered for '${server.name}'. Run 'mcpsm tools discover ${serverNameOrId}' first.${colors.reset}`
          );
          return;
        }

        const enabledSet = new Set(filter.enabled || filter.allTools);
        const disabledSet = new Set(filter.disabledTools || []);
        const isToolEnabled = (name: string): boolean =>
          enabledSet.has(name) && !disabledSet.has(name);

        if (options.json) {
          outputJson({
            server: server.name,
            serverId: server.id,
            tools: filter.allTools.map((name) => ({
              name,
              enabled: isToolEnabled(name),
              tokens: filter.toolsData?.[name]?.tokens || 0,
              kind: getToolKind(filter.toolsData?.[name]?.annotations),
              annotations: filter.toolsData?.[name]?.annotations,
            })),
            totalTokens: filter.totalTokens || 0,
          });
          return;
        }

        console.log(`\n${colors.bright}${colors.cyan}Tools for ${server.name}${colors.reset}\n`);

        for (const name of filter.allTools) {
          const isEnabled = isToolEnabled(name);
          if (!options.all && !isEnabled) continue;

          const status = isEnabled
            ? `${colors.green}enabled${colors.reset}`
            : `${colors.red}disabled${colors.reset}`;
          const tokens = filter.toolsData?.[name]?.tokens
            ? ` ${colors.gray}(${formatTokens(filter.toolsData[name].tokens)})${colors.reset}`
            : "";
          const badges = getToolBadges(filter.toolsData?.[name]?.annotations)
            .map((badge) => ` ${colors.gray}[${badge}]${colors.reset}`)
            .join("");

          console.log(
            `  ${isEnabled ? "☑" : "☐"} ${colors.cyan}${name}${colors.reset}${badges} - ${status}${tokens}`
          );
        }

        const enabledCount = filter.allTools.filter(isToolEnabled).length;
        console.log(
          `\n${colors.gray}${enabledCount}/${filter.allTools.length} tools enabled${colors.reset}`
        );
        if (filter.totalTokens) {
          console.log(
            `${colors.gray}Total tokens: ${formatTokens(filter.totalTokens)}${colors.reset}`
          );
        }
        return;
      }

      // Show all servers summary
      const localServers = configService.getLocalServers();
      const remoteServers = configService.getRemoteServers();

      if (options.json) {
        outputJson({
          servers: [
            ...localServers.map((s) => ({
              name: s.name,
              id: s.id,
              type: "stdio",
              toolCount: toolFilters[s.id]?.allTools?.length || 0,
              enabledCount:
                toolFilters[s.id]?.enabled?.length ?? toolFilters[s.id]?.allTools?.length ?? 0,
              totalTokens: toolFilters[s.id]?.totalTokens || 0,
            })),
            ...remoteServers.map((s) => ({
              name: s.name,
              id: s.id,
              type: s.type,
              toolCount: toolFilters[`remote:${s.id}`]?.allTools?.length || 0,
              enabledCount:
                toolFilters[`remote:${s.id}`]?.enabled?.length ??
                toolFilters[`remote:${s.id}`]?.allTools?.length ??
                0,
              totalTokens: toolFilters[`remote:${s.id}`]?.totalTokens || 0,
            })),
          ],
        });
        return;
      }

      console.log(`\n${colors.bright}${colors.cyan}Tools Summary${colors.reset}\n`);

      if (localServers.length === 0 && remoteServers.length === 0) {
        console.log(`${colors.gray}No servers configured.${colors.reset}`);
        return;
      }

      if (localServers.length > 0) {
        console.log(`${colors.bright}Local Servers:${colors.reset}`);
        for (const server of localServers) {
          const filter = toolFilters[server.id];
          const toolCount = filter?.allTools?.length || 0;
          const enabledCount = filter?.enabled?.length ?? toolCount;
          const tokens = filter?.totalTokens
            ? ` · ${colors.magenta}${formatTokens(filter.totalTokens)}${colors.reset}`
            : "";
          const status =
            toolCount === 0
              ? `${colors.yellow}not discovered${colors.reset}`
              : `${colors.green}${enabledCount}/${toolCount} enabled${colors.reset}`;

          console.log(`  ${colors.cyan}${server.name}${colors.reset} - ${status}${tokens}`);
        }
      }

      if (remoteServers.length > 0) {
        if (localServers.length > 0) console.log();
        console.log(`${colors.bright}Remote Servers:${colors.reset}`);
        for (const server of remoteServers) {
          const filter = toolFilters[`remote:${server.id}`];
          const toolCount = filter?.allTools?.length || 0;
          const enabledCount = filter?.enabled?.length ?? toolCount;
          const tokens = filter?.totalTokens
            ? ` · ${colors.magenta}${formatTokens(filter.totalTokens)}${colors.reset}`
            : "";
          const status =
            toolCount === 0
              ? `${colors.yellow}not discovered${colors.reset}`
              : `${colors.green}${enabledCount}/${toolCount} enabled${colors.reset}`;

          console.log(
            `  ${colors.cyan}${server.name}${colors.reset} (${server.type}) - ${status}${tokens}`
          );
        }
      }

      console.log(
        `\n${colors.gray}Use 'mcpsm tools <server>' to see detailed tools for a server${colors.reset}`
      );
    });

  // Discover tools
  tools
    .command("discover <server>")
    .description("Discover tools from a server")
    .action(async (serverNameOrId: string) => {
      const configService = getConfigService();
      const testingService = getTestingService();

      const result = configService.findServer(serverNameOrId);
      if (!result) {
        console.log(`${c.cross} Server '${serverNameOrId}' not found`);
        process.exit(1);
      }

      const { server, type } = result;
      console.log(`\n${colors.cyan}Discovering tools for ${server.name}...${colors.reset}`);

      const testResult = await testingService.testServer(server, type);

      if (testResult.success) {
        await refreshDaemonIfRunning();
        console.log(`${c.checkmark} Discovered ${testResult.toolCount} tools for '${server.name}'`);
      } else {
        console.log(`${c.cross} Failed to discover tools: ${testResult.error}`);
        process.exit(1);
      }
    });

  // Enable tool(s)
  tools
    .command("enable <server> [tool]")
    .description("Enable a tool or all tools for a server")
    .option("--all", "Enable all tools")
    .option("--read-only", "Enable all read-only tools")
    .option("--destructive", "Enable all destructive tools")
    .action(async (serverNameOrId: string, toolName: string | undefined, options) => {
      const configService = getConfigService();
      const toolFilters = configService.getToolFilters();

      const result = configService.findServer(serverNameOrId);
      if (!result) {
        console.log(`${c.cross} Server '${serverNameOrId}' not found`);
        process.exit(1);
      }

      const { server, type } = result;
      const filterId = configService.getFilterId(server.id, type);
      const filter = toolFilters[filterId];

      if (!filter || !filter.allTools || filter.allTools.length === 0) {
        console.log(
          `${c.cross} No tools discovered for '${server.name}'. Run 'mcpsm tools discover ${serverNameOrId}' first.`
        );
        process.exit(1);
      }

      const groupToolNames = getGroupToolNames(filter, options);
      if (groupToolNames) {
        configService.setToolsEnabled(filterId, groupToolNames, true);
        await refreshDaemonIfRunning();
        console.log(
          `${c.checkmark} Enabled ${groupToolNames.length} selected tools for '${server.name}'`
        );
        return;
      }

      if (options.all || !toolName) {
        // Enable all tools
        configService.setServerToolFilter(filterId, {
          ...filter,
          enabled: [...filter.allTools],
        });
        await refreshDaemonIfRunning();
        console.log(
          `${c.checkmark} Enabled all ${filter.allTools.length} tools for '${server.name}'`
        );
        return;
      }

      // Enable specific tool
      if (!filter.allTools.includes(toolName)) {
        console.log(`${c.cross} Tool '${toolName}' not found in server '${server.name}'`);
        console.log(`Available tools: ${filter.allTools.join(", ")}`);
        process.exit(1);
      }

      const enabled = new Set(filter.enabled || []);
      if (enabled.has(toolName)) {
        console.log(`${colors.yellow}Tool '${toolName}' is already enabled${colors.reset}`);
        return;
      }

      enabled.add(toolName);
      configService.setServerToolFilter(filterId, {
        ...filter,
        enabled: Array.from(enabled),
      });
      await refreshDaemonIfRunning();

      console.log(`${c.checkmark} Enabled tool '${toolName}' for '${server.name}'`);
    });

  // Disable tool(s)
  tools
    .command("disable <server> [tool]")
    .description("Disable a tool or all tools for a server")
    .option("--all", "Disable all tools")
    .option("--read-only", "Disable all read-only tools")
    .option("--destructive", "Disable all destructive tools")
    .action(async (serverNameOrId: string, toolName: string | undefined, options) => {
      const configService = getConfigService();
      const toolFilters = configService.getToolFilters();

      const result = configService.findServer(serverNameOrId);
      if (!result) {
        console.log(`${c.cross} Server '${serverNameOrId}' not found`);
        process.exit(1);
      }

      const { server, type } = result;
      const filterId = configService.getFilterId(server.id, type);
      const filter = toolFilters[filterId];

      if (!filter || !filter.allTools || filter.allTools.length === 0) {
        console.log(
          `${c.cross} No tools discovered for '${server.name}'. Run 'mcpsm tools discover ${serverNameOrId}' first.`
        );
        process.exit(1);
      }

      const groupToolNames = getGroupToolNames(filter, options);
      if (groupToolNames) {
        configService.setToolsEnabled(filterId, groupToolNames, false);
        await refreshDaemonIfRunning();
        console.log(
          `${c.checkmark} Disabled ${groupToolNames.length} selected tools for '${server.name}'`
        );
        return;
      }

      if (options.all) {
        // Disable all tools
        configService.setServerToolFilter(filterId, {
          ...filter,
          enabled: [],
        });
        await refreshDaemonIfRunning();
        console.log(`${c.checkmark} Disabled all tools for '${server.name}'`);
        return;
      }

      if (!toolName) {
        console.log(`${c.cross} Tool name required`);
        console.log(`Usage: mcpsm tools disable <server> <tool>`);
        console.log(`       mcpsm tools disable <server> --all`);
        process.exit(1);
      }

      // Disable specific tool
      if (!filter.allTools.includes(toolName)) {
        console.log(`${c.cross} Tool '${toolName}' not found in server '${server.name}'`);
        console.log(`Available tools: ${filter.allTools.join(", ")}`);
        process.exit(1);
      }

      const enabled = new Set(filter.enabled || filter.allTools);
      if (!enabled.has(toolName)) {
        console.log(`${colors.yellow}Tool '${toolName}' is already disabled${colors.reset}`);
        return;
      }

      enabled.delete(toolName);
      configService.setServerToolFilter(filterId, {
        ...filter,
        enabled: Array.from(enabled),
      });
      await refreshDaemonIfRunning();

      console.log(`${c.checkmark} Disabled tool '${toolName}' for '${server.name}'`);
    });
}
