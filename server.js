const { spawn } = require("child_process");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware for JSON parsing
app.use(express.json());

// Health check endpoint (required for Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "graphql-mock-router",
    version: "1.0.0",
    uptime: process.uptime(),
  });
});

// Basic service info endpoint
app.get("/", (req, res) => {
  res.json({
    service: "GraphQL Mock Router",
    description: "AI-powered GraphQL subgraph mocking",
    endpoints: {
      graphql: "/graphql",
      health: "/health",
      info: "/",
    },
    status: "running",
  });
});

// Service status endpoint
app.get("/status", (req, res) => {
  res.json({
    coprocessor: coprocessorRunning ? "running" : "stopped",
    router: routerRunning ? "running" : "stopped",
    apollo_key_set: !!process.env.APOLLO_KEY,
    supergraph_schema_exists: fs.existsSync("./supergraph-schema.graphql"),
    port: PORT,
    node_env: process.env.NODE_ENV || "development",
  });
});

let coprocessor, router;
let coprocessorRunning = false;
let routerRunning = false;

function startCoprocessor() {
  console.log("Starting coprocessor from src/index.ts...");

  // Try to start compiled JavaScript version first
  if (fs.existsSync("./dist/index.js")) {
    console.log("Found compiled version, using dist/index.js");
    try {
      coprocessor = spawn("node", ["dist/index.js"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PORT: "4001",
        },
      });
    } catch (error) {
      console.log("Compiled version failed, trying yarn script...");
      startCoprocessorFallback();
      return;
    }
  } else {
    startCoprocessorFallback();
    return;
  }

  function startCoprocessorFallback() {
    // Try yarn script
    try {
      coprocessor = spawn("yarn", ["start:coprocessor"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PORT: "4001",
        },
      });
    } catch (error) {
      console.log("Yarn script failed, trying ts-node directly...");
      try {
        coprocessor = spawn("npx", ["ts-node", "src/index.ts"], {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            PORT: "4001",
          },
        });
      } catch (tsError) {
        console.error(
          "All coprocessor startup methods failed:",
          tsError.message
        );
        coprocessorRunning = false;
        return;
      }
    }
  }

  coprocessor.stdout.on("data", (data) => {
    console.log(`[Coprocessor] ${data.toString().trim()}`);
  });

  coprocessor.stderr.on("data", (data) => {
    console.error(`[Coprocessor Error] ${data.toString().trim()}`);
  });

  coprocessor.on("spawn", () => {
    console.log("Coprocessor spawned successfully");
    coprocessorRunning = true;
  });

  coprocessor.on("error", (err) => {
    console.error("Coprocessor spawn error:", err);
    coprocessorRunning = false;
  });

  coprocessor.on("exit", (code, signal) => {
    console.log(`Coprocessor exited with code ${code} and signal ${signal}`);
    coprocessorRunning = false;

    // Restart coprocessor if it crashes (unless we're shutting down)
    if (!shuttingDown && code !== 0) {
      console.log("Restarting coprocessor in 5 seconds...");
      setTimeout(startCoprocessor, 5000);
    }
  });
}

function startRouter() {
  console.log("Starting Apollo Router...");

  // Check if router binary exists
  if (!fs.existsSync("/usr/local/bin/router") && !fs.existsSync("./router")) {
    console.error("Router binary not found. Installing...");
    installRouter();
    return;
  }

  // Check if supergraph schema exists
  if (!fs.existsSync("./supergraph-schema.graphql")) {
    console.error("supergraph-schema.graphql not found in project root");
    return;
  }

  // Check if Apollo key is set
  if (!process.env.APOLLO_KEY) {
    console.error("APOLLO_KEY environment variable is required");
    return;
  }

  // Use different port for router to avoid conflict with Express
  const routerPort = PORT === process.env.PORT ? 4002 : 4000;

  // Try to start router using yarn script first, then fallback to direct binary
  try {
    router = spawn("yarn", ["start:router"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        APOLLO_KEY: process.env.APOLLO_KEY,
        APOLLO_ROUTER_LISTEN: `127.0.0.1:${routerPort}`,
        ROUTER_PORT: routerPort,
      },
    });
  } catch (error) {
    console.log("Yarn script not found, trying direct router binary...");
    router = spawn("router", ["--config", "router.yaml"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        APOLLO_KEY: process.env.APOLLO_KEY,
        APOLLO_ROUTER_LISTEN: `127.0.0.1:${routerPort}`,
        ROUTER_PORT: routerPort,
      },
    });
  }

  router.stdout.on("data", (data) => {
    console.log(`[Router] ${data.toString().trim()}`);
  });

  router.stderr.on("data", (data) => {
    console.error(`[Router Error] ${data.toString().trim()}`);
  });

  router.on("spawn", () => {
    console.log("Router spawned successfully");
    routerRunning = true;
  });

  router.on("error", (err) => {
    console.error("Router spawn error:", err);
    routerRunning = false;
  });

  router.on("exit", (code, signal) => {
    console.log(`Router exited with code ${code} and signal ${signal}`);
    routerRunning = false;

    // Restart router if it crashes (unless we're shutting down)
    if (!shuttingDown && code !== 0) {
      console.log("Restarting router in 5 seconds...");
      setTimeout(startRouter, 5000);
    }
  });
}

function installRouter() {
  console.log("Installing Apollo Router...");

  const install = spawn(
    "sh",
    ["-c", "curl -sSL https://router.apollo.dev/download/nix/latest | sh"],
    {
      stdio: "inherit",
    }
  );

  install.on("exit", (code) => {
    if (code === 0) {
      console.log("Router installed successfully");
      // Move router to accessible location
      const move = spawn("mv", ["router", "/usr/local/bin/"], {
        stdio: "inherit",
      });

      move.on("exit", (moveCode) => {
        if (moveCode === 0) {
          console.log("Router moved to /usr/local/bin/");
          setTimeout(startRouter, 2000);
        } else {
          console.error("Failed to move router binary");
        }
      });
    } else {
      console.error("Failed to install router");
    }
  });
}

function startServices() {
  console.log("=".repeat(50));
  console.log("Starting GraphQL Mock Router Services");
  console.log("=".repeat(50));
  console.log(`Node.js version: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Port: ${PORT}`);
  console.log(`Apollo Key set: ${!!process.env.APOLLO_KEY}`);
  console.log("=".repeat(50));

  // Start coprocessor first
  startCoprocessor();

  // Start router after a delay to allow coprocessor to initialize
  setTimeout(() => {
    startRouter();
  }, 3000);
}

let shuttingDown = false;

// Graceful shutdown
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  const shutdownPromises = [];

  if (coprocessor && coprocessorRunning) {
    shutdownPromises.push(
      new Promise((resolve) => {
        coprocessor.kill("SIGTERM");
        coprocessor.on("exit", resolve);
        setTimeout(() => {
          coprocessor.kill("SIGKILL");
          resolve();
        }, 5000);
      })
    );
  }

  if (router && routerRunning) {
    shutdownPromises.push(
      new Promise((resolve) => {
        router.kill("SIGTERM");
        router.on("exit", resolve);
        setTimeout(() => {
          router.kill("SIGKILL");
          resolve();
        }, 5000);
      })
    );
  }

  Promise.all(shutdownPromises).then(() => {
    console.log("All services shut down. Exiting...");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.log("Force exiting...");
    process.exit(1);
  }, 10000);
}

// Handle various shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  shutdown("unhandledRejection");
});

// Start the health check server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Health check server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);

  // Start the main services
  startServices();
});

// Periodic health logging
setInterval(() => {
  console.log(
    `[Health] Coprocessor: ${coprocessorRunning ? "OK" : "DOWN"}, Router: ${
      routerRunning ? "OK" : "DOWN"
    }`
  );
}, 60000); // Log every minute
