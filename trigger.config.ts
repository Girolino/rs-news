import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF || "<project-ref>",

  // Diretório onde as tasks estão localizadas
  dirs: ["./trigger"],

  // Runtime
  runtime: "node",

  // Log level
  logLevel: "info",

  // Retry settings padrão
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },

  // Build configuration
  build: {
    autoDetectExternal: true,
    keepNames: true,
    minify: false,
    extensions: [],
  },

  // Max duration padrão (em segundos)
  maxDuration: 600, // 10 minutos

  // Console logging em desenvolvimento
  enableConsoleLogging: true,
});
