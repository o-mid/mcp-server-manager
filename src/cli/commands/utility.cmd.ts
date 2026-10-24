/**
 * Utility commands - doctor, config, tokens
 */

import { Command } from "commander";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import { colors, c } from "../../shared/colors.js";
import { formatTokens, outputJson } from "../../shared/formatters.js";
import { getConfigService } from "../../services/config.service.js";
import { changeGatewayPort } from "../../services/gateway-port.service.js";
import { getSettingsService } from "../../services/settings.service.js";
import { VERSION } from "../../shared/version.js";

/** Check if a command exists */
function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Get command version */
function getVersion(cmd: string): string | null {
  try {
    const result = execSync(`${cmd} --version`, { encoding: "utf8" });
    return result.trim().split("\n")[0];
  } catch {
    return null;
  }
}

/** Register utility commands */
export function registerUtilityCommands(program: Command): void {
  // Doctor command
  program
    .command("doctor")
    .description("Check system health and dependencies")
    .action(async () => {
      console.log(
        `\n${colors.bright}${colors.cyan}MCP Server Manager - Health Check${colors.reset}\n`
      );

      const checks: Array<{ name: string; status: boolean; info: string }> = [];

      // Node.js
      const nodeVersion = process.version;
      const nodeOk = parseInt(nodeVersion.slice(1)) >= 18;
      checks.push({
        name: "Node.js",
        status: nodeOk,
        info: nodeOk ? nodeVersion : `${nodeVersion} (requires >= 18.0.0)`,
      });

      // Python
      const pythonExists = commandExists("python3") || commandExists("python");
      const pythonVersion = pythonExists ? getVersion("python3") || getVersion("python") : null;
      checks.push({
        name: "Python",
        status: pythonExists,
        info: pythonVersion || "not found",
      });

      // uv
      const uvExists = commandExists("uv");
      const uvVersion = uvExists ? getVersion("uv") : null;
      checks.push({
        name: "uv",
        status: uvExists,
        info: uvVersion || "not found (optional)",
      });

      // uvx
      const uvxExists = commandExists("uvx");
      checks.push({
        name: "uvx",
        status: uvxExists,
        info: uvxExists ? "available" : "not found (optional)",
      });

      // npm
      const npmExists = commandExists("npm");
      const npmVersion = npmExists ? getVersion("npm") : null;
      checks.push({
        name: "npm",
        status: npmExists,
        info: npmVersion || "not found",
      });

      // Config directory
      const configService = getConfigService();
      const paths = configService.getPaths();
      const configExists = fs.existsSync(paths.configDir);
      checks.push({
        name: "Config directory",
        status: configExists,
        info: configExists ? paths.configDir : "not created",
      });

      // Config file
      const configFileExists = fs.existsSync(paths.configPath);
      checks.push({
        name: "Config file",
        status: configFileExists,
        info: configFileExists ? "exists" : "not found",
      });

      // Servers count
      const localServers = configService.getLocalServers();
      const remoteServers = configService.getRemoteServers();
      const totalServers = localServers.length + remoteServers.length;
      checks.push({
        name: "Servers configured",
        status: true,
        info: `${totalServers} (${localServers.length} local, ${remoteServers.length} remote)`,
      });

      // Print results
      for (const check of checks) {
        const icon = check.status ? c.checkmark : c.cross;
        const infoColor = check.status ? colors.green : colors.yellow;
        console.log(`  ${icon} ${check.name}: ${infoColor}${check.info}${colors.reset}`);
      }

      const allOk = checks.every((c) => c.status || c.name.includes("uv"));
      console.log();
      if (allOk) {
        console.log(`${c.checkmark} All checks passed!`);
      } else {
        console.log(`${c.warning_icon} Some checks failed. See above for details.`);
      }
    });

  // Config command
  program
    .command("config")
    .description("Open config file in editor or show path")
    .option("--path", "Show config file path")
    .option("--dir", "Show config directory path")
    .action(async (options) => {
      const configService = getConfigService();
      const paths = configService.getPaths();

      if (options.path) {
        console.log(paths.configPath);
        return;
      }

      if (options.dir) {
        console.log(paths.configDir);
        return;
      }

      // Open in editor
      const settingsService = getSettingsService();
      const editor = settingsService.get("editor");

      console.log(`Opening ${paths.configPath} in ${editor}...`);

      try {
        spawnSync(editor, [paths.configPath], { stdio: "inherit" });
      } catch {
        console.log(`${c.cross} Failed to open editor`);
        console.log(`Config file: ${paths.configPath}`);
        process.exit(1);
      }
    });

  // Tokens command
  program
    .command("tokens")
    .description("Show token usage by server and tool")
    .option("-d, --detailed", "Show per-tool token breakdown")
    .option("--json", "Output in JSON format")
    .action(async (options) => {
      const configService = getConfigService();
      const toolFilters = configService.getToolFilters();
      const localServers = configService.getLocalServers();
      const remoteServers = configService.getRemoteServers();

      interface ServerTokenInfo {
        name: string;
        id: string;
        type: string;
        totalTokens: number;
        toolCount: number;
        tools?: Array<{ name: string; tokens: number }>;
      }

      const servers: ServerTokenInfo[] = [];
      let grandTotal = 0;

      // Process local servers
      for (const server of localServers) {
        const filter = toolFilters[server.id];
        if (!filter?.toolsData) continue;

        const serverInfo: ServerTokenInfo = {
          name: server.name,
          id: server.id,
          type: "stdio",
          totalTokens: filter.totalTokens || 0,
          toolCount: filter.allTools?.length || 0,
        };

        if (options.detailed) {
          serverInfo.tools = Object.entries(filter.toolsData).map(([name, data]) => ({
            name,
            tokens: data.tokens || 0,
          }));
        }

        servers.push(serverInfo);
        grandTotal += serverInfo.totalTokens;
      }

      // Process remote servers
      for (const server of remoteServers) {
        const filter = toolFilters[`remote:${server.id}`];
        if (!filter?.toolsData) continue;

        const serverInfo: ServerTokenInfo = {
          name: server.name,
          id: server.id,
          type: server.type,
          totalTokens: filter.totalTokens || 0,
          toolCount: filter.allTools?.length || 0,
        };

        if (options.detailed) {
          serverInfo.tools = Object.entries(filter.toolsData).map(([name, data]) => ({
            name,
            tokens: data.tokens || 0,
          }));
        }

        servers.push(serverInfo);
        grandTotal += serverInfo.totalTokens;
      }

      if (options.json) {
        outputJson({ servers, grandTotal });
        return;
      }

      console.log(`\n${colors.bright}${colors.cyan}Token Usage${colors.reset}\n`);

      if (servers.length === 0) {
        console.log(`${colors.gray}No token data available.${colors.reset}`);
        console.log(
          `${colors.gray}Run 'mcpsm test' to discover tools and count tokens.${colors.reset}`
        );
        return;
      }

      for (const server of servers) {
        const typeLabel = server.type !== "stdio" ? ` (${server.type})` : "";
        console.log(
          `${colors.cyan}${server.name}${colors.reset}${typeLabel}: ${colors.magenta}${formatTokens(server.totalTokens)}${colors.reset} tokens (${server.toolCount} tools)`
        );

        if (options.detailed && server.tools) {
          for (const tool of server.tools.sort((a, b) => b.tokens - a.tokens)) {
            console.log(
              `  ${colors.gray}${tool.name}${colors.reset}: ${formatTokens(tool.tokens)}`
            );
          }
        }
      }

      console.log(
        `\n${colors.bright}Total: ${colors.magenta}${formatTokens(grandTotal)}${colors.reset} tokens`
      );
    });

  // Version command
  program
    .command("version")
    .description("Show version information")
    .option("--json", "Output in JSON format")
    .action((options) => {
      if (options.json) {
        outputJson({ version: VERSION });
        return;
      }
      console.log(`MCP Server Manager v${VERSION}`);
    });

  // Port command
  program
    .command("port [number]")
    .description("Get or set the gateway port")
    .action(async (portNumber?: string) => {
      const configService = getConfigService();

      if (!portNumber) {
        console.log(configService.getPort());
        return;
      }

      const port = Number(portNumber);
      if (isNaN(port)) {
        console.log(`${c.cross} Invalid port number: ${portNumber}`);
        process.exit(1);
      }

      const result = await changeGatewayPort(port);
      if (!result.success) {
        console.log(`${c.cross} ${result.error}`);
        process.exit(1);
      }

      console.log(`${c.checkmark} Port set to ${port}`);
      for (const warning of result.warnings)
        console.log(`${colors.yellow}${warning}${colors.reset}`);
    });
}
