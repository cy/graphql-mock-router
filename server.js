const { spawn } = require("child_process");
const express = require("express");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 4000;

// Health check endpoint (required for Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "graphql-mock-router",
  });
});

// Basic info endpoint
app.get("/", (req, res) => {
  res.json({
    service: "GraphQL Mock Router",
    description: "AI-powered GraphQL subgraph mocking",
    endpoints: {
      graphql: "/graphql",
      health: "/health",
    },
  });
});

let processes = [];

function startServices() {
  console.log("Starting GraphQL Mock Router services...");

  // Check if router binary exists, if not install it
  if (!fs.existsSync("./router") && !fs.existsSync("/usr/local/bin/router")) {
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
        startActualServices();
      } else {
        console.error("Failed to install router");
      }
    });
  } else {
    startActualServices();
  }
}

function startActualServices() {
  // Start coprocessor from index.ts
  try {
    const coprocessor = spawn("yarn", ["start:coprocessor"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: "4001", // Coprocessor port
      },
    });

    coprocessor.on("error", (err) => {
      console.log("Coprocessor failed to start:", err.message);
    });

    processes.push(coprocessor);
  } catch (error) {
    console.log("Coprocessor not available:", error.message);
  }

  // Start router after a delay to allow coprocessor to initialize
  setTimeout(() => {
    try {
      const router = spawn("yarn", ["start:router"], {
        stdio: "inherit",
        env: {
          ...process.env,
          APOLLO_KEY: process.env.APOLLO_KEY,
          PORT: PORT,
        },
      });

      router.on("error", (err) => {
        console.error("Router error:", err);
      });

      processes.push(router);
    } catch (error) {
      console.error("Failed to start router:", error);
    }
  }, 3000); // Longer delay for TypeScript compilation
}

// Graceful shutdown
function shutdown() {
  console.log("Shutting down services...");
  processes.forEach((proc) => {
    if (proc && proc.pid) {
      proc.kill("SIGTERM");
    }
  });
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start health check server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  startServices();
});
