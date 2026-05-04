const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const backendDir = path.join(rootDir, "backend");
const managedChildren = [];

function startProcess(name, cwd, args) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32" ? ["/c", "npm.cmd", ...args] : args;

  const child = spawn(command, commandArgs, {
    cwd,
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}.`);
    }
  });

  managedChildren.push(child);
  return child;
}

function probeUrl(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode < 500));
    });

    request.on("error", () => resolve(false));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function waitForUrl(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function attempt() {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }

        retry();
      });

      request.on("error", retry);
      request.setTimeout(1000, () => {
        request.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(attempt, 250);
    }

    attempt();
  });
}

async function main() {
  console.log("Starting ShopSphere frontend and backend...");

  const frontendUrl = "http://127.0.0.1:3000/";
  const backendUrl = "http://127.0.0.1:5001/api/health";
  const [frontendAlreadyRunning, backendAlreadyRunning] = await Promise.all([
    probeUrl(frontendUrl),
    probeUrl(backendUrl)
  ]);

  const shutdown = () => {
    managedChildren.forEach((child) => child.kill());
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (frontendAlreadyRunning) {
    console.log("Frontend already running on http://localhost:3000");
  } else {
    console.log("Launching frontend...");
    startProcess("Frontend", frontendDir, ["start"]);
  }

  if (backendAlreadyRunning) {
    console.log("Backend already running on http://localhost:5001");
  } else {
    console.log("Launching backend...");
    startProcess("Backend", backendDir, ["start"]);
  }

  try {
    await Promise.all([waitForUrl(frontendUrl), waitForUrl(backendUrl)]);
    console.log("ShopSphere is ready.");
    console.log("Frontend: http://localhost:3000");
    console.log("Backend:  http://localhost:5001/api/health");
  } catch (error) {
    console.warn(error.message);
  }
}

main();
