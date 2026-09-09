import { execSync } from "node:child_process";

const DEV_PORTS = [3050, 5173];

function killPort(port: number): void {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${port}`).toString();
      const pids = new Set(
        output
          .split("\n")
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid): pid is string => !!pid && pid !== "0")
      );

      for (const pid of pids) {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Stopped process ${pid} on port ${port}`);
      }
    } else {
      const output = execSync(`lsof -ti tcp:${port}`).toString().trim();
      if (!output) return;

      for (const pid of output.split("\n")) {
        execSync(`kill -9 ${pid}`);
        console.log(`Stopped process ${pid} on port ${port}`);
      }
    }
  } catch {
    // Nothing listening on this port — nothing to stop.
  }
}

for (const port of DEV_PORTS) {
  killPort(port);
}
