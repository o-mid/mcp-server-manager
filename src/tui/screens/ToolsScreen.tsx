/**
 * ToolsScreen - Manage tool filtering for a specific server (ink component)
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { ScreenLayout, ScrollableList } from "../components/index.js";
import { createMenuSections } from "../utils/menu.js";
import { getConfigService } from "../../services/config.service.js";
import { getDaemonService } from "../../services/daemon.service.js";
import { getTestingService } from "../../services/testing.service.js";
import type { ServerToolFilter } from "../../types/index.js";
import { formatTokens } from "../../shared/formatters.js";
import { getToolBadges, getToolNamesByKind } from "../../shared/toolAnnotations.js";
import type { ToolKind } from "../../shared/toolAnnotations.js";
import { getEnabledTokenTotal } from "../utils/tokenTotals.js";
import { useTheme } from "../theme/index.js";

interface ToolsScreenProps {
  onBack: () => void;
  initialServerId?: string; // Server to show tools for
}

interface ToolsState {
  serverId: string;
  serverName: string;
  filter: ServerToolFilter | null;
  tools: string[];
  currentToolIndex: number;
  message: string | null;
  messageType: "success" | "error" | "info";
  isTesting: boolean;
  view: "server" | "global";
  globalIndex: number;
}

type ToolRow =
  | { type: "group"; kind: Exclude<ToolKind, "unclassified">; names: string[] }
  | { type: "tool"; name: string };

const GROUP_KINDS = ["read-only", "destructive"] as const;

function buildRows(filter: ServerToolFilter | null): ToolRow[] {
  if (!filter) return [];

  const groups = GROUP_KINDS.map((kind) => ({
    type: "group" as const,
    kind,
    names: getToolNamesByKind(filter, kind),
  })).filter((group) => group.names.length > 0);
  const tools = (filter.allTools || []).map((name) => ({ type: "tool" as const, name }));

  return [...groups, ...tools];
}

function getRowKey(row: ToolRow): string {
  return row.type === "group" ? `group:${row.kind}` : `tool:${row.name}`;
}

export function ToolsScreen({ onBack, initialServerId }: ToolsScreenProps): React.ReactElement {
  const { theme } = useTheme();
  const configService = getConfigService();
  const daemonService = getDaemonService();
  const testingService = getTestingService();

  const [state, setState] = useState<ToolsState>(() => {
    const localServers = configService.getLocalServers();
    const remoteServers = configService.getRemoteServers();

    // Find the server
    let serverId = initialServerId || "";
    let serverName = "";

    if (initialServerId?.startsWith("remote:")) {
      const id = initialServerId.replace("remote:", "");
      const server = remoteServers.find((s) => s.id === id);
      if (server) {
        serverId = initialServerId;
        serverName = server.name;
      }
    } else if (initialServerId) {
      const server = localServers.find((s) => s.id === initialServerId);
      if (server) {
        serverId = initialServerId;
        serverName = server.name;
      }
    }

    // Load tools for the server
    const toolFilters = configService.getToolFilters();
    const filter = serverId ? toolFilters[serverId] || null : null;

    return {
      serverId,
      serverName,
      filter,
      tools: filter?.allTools || [],
      currentToolIndex: 0,
      message: null,
      messageType: "info",
      isTesting: false,
      view: serverId ? "server" : "global",
      globalIndex: 0,
    };
  });

  // Reload tools from config
  const reloadTools = useCallback(
    (preserveIndex = false) => {
      const toolFilters = configService.getToolFilters();
      const filter = state.serverId ? toolFilters[state.serverId] || null : null;

      setState((prev) => {
        const nextRows = buildRows(filter);
        const selectedRow = buildRows(prev.filter)[prev.currentToolIndex];
        const selectedIndex = selectedRow
          ? nextRows.findIndex((row) => getRowKey(row) === getRowKey(selectedRow))
          : -1;
        const preservedIndex =
          selectedIndex >= 0 ? selectedIndex : Math.min(prev.currentToolIndex, nextRows.length - 1);

        return {
          ...prev,
          filter,
          tools: filter?.allTools || [],
          currentToolIndex: preserveIndex ? Math.max(preservedIndex, 0) : 0,
        };
      });
    },
    [state.serverId, configService]
  );

  // Show temporary message
  const showMessage = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setState((prev) => ({ ...prev, message: msg, messageType: type }));
    setTimeout(() => {
      setState((prev) => ({ ...prev, message: null }));
    }, 2000);
  }, []);

  const refreshDaemonIfRunning = useCallback(() => {
    if (daemonService.isDaemonRunning().running) {
      daemonService.refreshTools().catch((error) => {
        console.error("Failed to refresh tool list after changes:", error);
      });
    }
  }, [daemonService]);

  const buildGlobalTotals = useCallback(() => {
    const toolFilters = configService.getToolFilters();
    const localServers = configService.getLocalServers();
    const remoteServers = configService.getRemoteServers();

    const items = [
      ...localServers.map((s) => ({
        id: s.id,
        name: s.name,
        type: "local" as const,
        filter: toolFilters[s.id],
      })),
      ...remoteServers.map((s) => ({
        id: `remote:${s.id}`,
        name: s.name,
        type: "remote" as const,
        filter: toolFilters[`remote:${s.id}`],
      })),
    ].map((item) => ({
      ...item,
      totalTokens: item.filter?.totalTokens ?? 0,
      toolCount: item.filter?.allTools?.length ?? 0,
    }));

    const grandTotal = items.reduce((sum, item) => sum + item.totalTokens, 0);

    return { items, grandTotal };
  }, [configService]);

  const discoverTools = useCallback(async () => {
    const { serverId } = state;
    if (!serverId) {
      showMessage("No server selected to test", "error");
      return;
    }

    const id = serverId.startsWith("remote:") ? serverId.replace("remote:", "") : serverId;
    const result = configService.findServer(id);
    if (!result) {
      showMessage("Server not found", "error");
      return;
    }

    setState((prev) => ({
      ...prev,
      isTesting: true,
      message: "Discovering tools...",
      messageType: "info",
    }));

    try {
      const testResult = await testingService.testServer(result.server, result.type);
      reloadTools(true);
      if (testResult.success) {
        showMessage(`Discovered ${testResult.toolCount ?? 0} tools`, "success");
      } else {
        showMessage(testResult.error || "Discovery failed", "error");
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Failed to discover tools", "error");
    } finally {
      setState((prev) => ({ ...prev, isTesting: false }));
      refreshDaemonIfRunning();
    }
  }, [
    configService,
    refreshDaemonIfRunning,
    reloadTools,
    showMessage,
    state.serverId,
    testingService,
  ]);

  // Handle keyboard input
  useInput((input, key) => {
    const { serverId, tools, currentToolIndex, view } = state;
    const { items: globalItems } = buildGlobalTotals();
    const rows = buildRows(state.filter);

    // Quit / Back
    if (input === "q" || key.escape) {
      onBack();
      return;
    }

    // Toggle global view
    if (input.toLowerCase() === "g") {
      if (view === "server") {
        setState((prev) => ({ ...prev, view: "global", message: null }));
      } else if (state.serverId) {
        setState((prev) => ({ ...prev, view: "server", message: null }));
      }
      return;
    }

    if (view === "global") {
      if (globalItems.length === 0) return;

      if (key.upArrow) {
        setState((prev) => ({
          ...prev,
          globalIndex:
            prev.globalIndex <= 0
              ? globalItems.length - 1
              : (prev.globalIndex - 1) % globalItems.length,
        }));
        return;
      }

      if (key.downArrow) {
        setState((prev) => ({
          ...prev,
          globalIndex: (prev.globalIndex + 1) % Math.max(globalItems.length, 1),
        }));
        return;
      }

      if (key.return) {
        const item = globalItems[state.globalIndex] || globalItems[0];
        if (item) {
          const toolFilters = configService.getToolFilters();
          const filter = toolFilters[item.id] || null;
          setState((prev) => ({
            ...prev,
            serverId: item.id,
            serverName: item.name,
            filter,
            tools: filter?.allTools || [],
            currentToolIndex: 0,
            view: "server",
          }));
        }
        return;
      }

      return;
    }

    // Server view navigation
    if (key.upArrow && rows.length > 0) {
      setState((prev) => ({
        ...prev,
        currentToolIndex: (currentToolIndex - 1 + rows.length) % rows.length,
      }));
      return;
    }

    // Navigation - Down
    if (key.downArrow && rows.length > 0) {
      setState((prev) => ({
        ...prev,
        currentToolIndex: (currentToolIndex + 1) % rows.length,
      }));
      return;
    }

    // Toggle tool or whole group - Space
    if (input === " " && rows.length > 0 && serverId) {
      const row = rows[currentToolIndex];
      if (!row) return;

      if (row.type === "group") {
        const disabled = new Set(state.filter?.disabledTools || []);
        const allEnabled = row.names.every((name) => !disabled.has(name));
        configService.setToolsEnabled(serverId, row.names, !allEnabled);
      } else {
        configService.toggleTool(serverId, row.name);
      }
      refreshDaemonIfRunning();
      reloadTools(true);
      return;
    }

    // Enable all - A
    if (input.toLowerCase() === "a" && tools.length > 0 && serverId) {
      configService.enableAllTools(serverId);
      refreshDaemonIfRunning();
      reloadTools(true);
      showMessage("All tools enabled", "success");
      return;
    }

    // Disable all - N
    if (input.toLowerCase() === "n" && tools.length > 0 && serverId) {
      configService.disableAllTools(serverId);
      refreshDaemonIfRunning();
      reloadTools(true);
      showMessage("All tools disabled", "success");
      return;
    }

    // Discover tools - X
    if (input.toLowerCase() === "x" && serverId && !state.isTesting) {
      void discoverTools();
      return;
    }
  });

  const {
    serverName,
    tools,
    currentToolIndex,
    filter,
    message,
    messageType,
    isTesting,
    view,
    globalIndex,
  } = state;
  const { items: globalItems, grandTotal } = buildGlobalTotals();

  // Global view or no server selected
  if (view === "global" || !state.serverId) {
    const toolsMenuSections = createMenuSections({
      actions: [
        { key: "Enter", label: "View server tools" },
        { key: "G", label: "Toggle global/server" },
      ],
      showData: false,
      showConfig: false,
      showSystem: false,
    });

    return (
      <ScreenLayout
        title="Token Usage"
        subtitle={`Total tokens: ${formatTokens(grandTotal)}`}
        menuSections={toolsMenuSections}
      >
        {globalItems.length === 0 ? (
          <Box paddingX={1} paddingY={1} flexDirection="column">
            <Text dimColor>No servers configured.</Text>
            <Text dimColor>Press Q or ESC to go back.</Text>
          </Box>
        ) : (
          <ScrollableList
            items={globalItems.map((item) => item.id)}
            selectedIndex={globalIndex}
            emptyMessage="No servers configured."
            renderItem={(id, idx) => {
              const item = globalItems.find((i) => i.id === id);
              if (!item) return null;
              const isCurrent = idx === globalIndex;
              return (
                <Box key={id} gap={1} paddingX={1}>
                  <Text color={isCurrent ? theme.colors.highlightText : theme.colors.primary}>
                    {isCurrent ? "→" : " "}
                  </Text>
                  <Text color={isCurrent ? theme.colors.highlightText : undefined} bold={isCurrent}>
                    {item.name}
                  </Text>
                  <Text dimColor>[{item.type}]</Text>
                  <Text dimColor>·</Text>
                  <Text color={theme.colors.warning}>{formatTokens(item.totalTokens)} tokens</Text>
                  <Text dimColor>·</Text>
                  <Text dimColor>{item.toolCount} tools</Text>
                </Box>
              );
            }}
          />
        )}
      </ScreenLayout>
    );
  }

  const disabledTools = new Set(filter?.disabledTools || []);
  const allTools = filter?.allTools || [];
  const enabledCount = allTools.length - disabledTools.size;
  const enabledTokens = getEnabledTokenTotal(filter);
  const subtitle =
    allTools.length > 0
      ? `Enabled: ${enabledCount}/${allTools.length} | Tokens: ${
          enabledTokens !== null ? `${formatTokens(enabledTokens)} tokens` : "—"
        }`
      : undefined;

  const toolsMenuSections = createMenuSections({
    actions: [
      { key: "Space", label: "Toggle tool or group" },
      { key: "A", label: "Enable all" },
      { key: "N", label: "Disable all" },
      { key: "X", label: "Discover tools" },
      { key: "G", label: "Global tokens" },
    ],
    showData: false,
    showConfig: false,
    showSystem: false,
  });

  const footer = message ? (
    <Box flexDirection="column">
      <Text
        color={
          messageType === "success"
            ? theme.colors.success
            : messageType === "error"
              ? theme.colors.error
              : theme.colors.warning
        }
      >
        {messageType === "success" ? "✓" : messageType === "error" ? "✗" : isTesting ? "…" : "ℹ"}{" "}
        {message}
      </Text>
      <Text dimColor>
        Enabled: {enabledCount}/{allTools.length} · Tokens:{" "}
        {enabledTokens !== null ? `${formatTokens(enabledTokens)} tokens` : "—"}
      </Text>
    </Box>
  ) : (
    <Text dimColor>
      Enabled: {enabledCount}/{allTools.length} · Tokens:{" "}
      {enabledTokens !== null ? `${formatTokens(enabledTokens)} tokens` : "—"}
    </Text>
  );

  return (
    <ScreenLayout
      title={`Tools: ${serverName}`}
      subtitle={subtitle}
      menuSections={toolsMenuSections}
      highlightedView="T"
      footer={footer}
    >
      {tools.length === 0 ? (
        <Box paddingX={1} paddingY={1} flexDirection="column">
          <Text dimColor>No tools discovered for this server.</Text>
          <Text dimColor>Press X to test this server and discover tools.</Text>
        </Box>
      ) : (
        <ScrollableList
          items={buildRows(filter)}
          selectedIndex={currentToolIndex}
          emptyMessage="No tools discovered for this server."
          renderItem={(row, idx) => {
            const isCurrent = idx === currentToolIndex;

            if (row.type === "group") {
              const allEnabled = row.names.every((name) => !disabledTools.has(name));
              return (
                <Box key={`group:${row.kind}`} gap={1} paddingX={1}>
                  <Text color={isCurrent ? theme.colors.highlightText : theme.colors.primary}>
                    {isCurrent ? "→" : " "}
                  </Text>
                  <Text color={allEnabled ? theme.colors.success : theme.colors.error}>
                    {allEnabled ? "[✓]" : "[ ]"}
                  </Text>
                  <Text color={isCurrent ? "magenta" : undefined} bold>
                    All {row.kind} ({row.names.length})
                  </Text>
                </Box>
              );
            }

            const tool = row.name;
            const isEnabled = !disabledTools.has(tool);
            const tokens = filter?.toolsData?.[tool]?.tokens;
            const tokenLabel = typeof tokens === "number" ? `${formatTokens(tokens)} tokens` : null;
            const badges = getToolBadges(filter?.toolsData?.[tool]?.annotations);

            return (
              <Box key={tool} gap={1} paddingX={1}>
                <Text color={isCurrent ? theme.colors.highlightText : theme.colors.primary}>
                  {isCurrent ? "→" : " "}
                </Text>
                <Text color={isEnabled ? theme.colors.success : theme.colors.error}>
                  {isEnabled ? "[✓]" : "[ ]"}
                </Text>
                <Text
                  color={isCurrent ? "magenta" : isEnabled ? undefined : "gray"}
                  bold={isCurrent}
                >
                  {tool}
                </Text>
                {badges.map((badge) => (
                  <Text
                    key={badge}
                    color={
                      badge === "read-only"
                        ? theme.colors.success
                        : badge === "destructive"
                          ? theme.colors.error
                          : undefined
                    }
                    dimColor={badge === "idempotent"}
                  >
                    [{badge}]
                  </Text>
                ))}
                {tokenLabel && (
                  <>
                    <Text dimColor>·</Text>
                    <Text color={theme.colors.warning}>{tokenLabel}</Text>
                  </>
                )}
              </Box>
            );
          }}
        />
      )}
    </ScreenLayout>
  );
}

export default ToolsScreen;
