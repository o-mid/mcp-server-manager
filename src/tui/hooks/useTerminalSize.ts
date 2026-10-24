/**
 * Mimics gemini-cli's useTerminalSize hook to track terminal dimensions.
 */
import { useEffect, useState } from "react";
import { useStdout } from "ink";

interface TerminalSize {
  columns: number;
  rows: number;
}

function getTerminalSize(stdout: ReturnType<typeof useStdout>["stdout"]) {
  const columns = "columns" in stdout ? stdout.columns : undefined;
  const rows = "rows" in stdout ? stdout.rows : undefined;
  return {
    columns: typeof columns === "number" ? columns || 60 : 60,
    rows: typeof rows === "number" ? rows || 20 : 20,
  };
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => getTerminalSize(stdout));

  useEffect(() => {
    if (!stdout) return;

    const updateSize = (): void => {
      setSize(getTerminalSize(stdout));
    };

    stdout.on("resize", updateSize);
    // Ensure we update immediately in case dimensions changed
    updateSize();
    return (): void => {
      stdout.off("resize", updateSize);
    };
  }, [stdout]);

  return size;
}
