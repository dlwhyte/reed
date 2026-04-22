import { defineConfig, devices } from "@playwright/test";
import * as os from "os";
import * as path from "path";

// A temp dir per run keeps the seeded fixture DB isolated from the
// user's real ~/ReaderData and ensures a clean slate each test run.
const TEST_DATA_DIR = path.join(
  os.tmpdir(),
  `reed-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
);

const PORT = Number(process.env.E2E_PORT || 8766);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // These are smoke tests, not a full matrix.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Seed the DB, then launch uvicorn against the seeded directory with
    // the LLM path disabled and private-URL saving allowed (tests use
    // example.com fixtures that DNS-resolve to whatever — we don't care).
    // Seed the DB and serve the backend from inside the backend venv so
    // python-dotenv et al. are on the path. The seed path is relative to
    // the backend cwd after the cd.
    command: [
      `cd ../backend && . .venv/bin/activate`,
      `&&`,
      `python ../frontend/e2e/seed_db.py`,
      `&&`,
      `uvicorn app.main:app --host 127.0.0.1 --port ${PORT}`,
    ].join(" "),
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATA_DIR: TEST_DATA_DIR,
      ENABLE_LLM: "false",
      COHERE_API_KEY: "",
      TAVILY_API_KEY: "",
      READER_ALLOW_PRIVATE_URLS: "true",
      PORT: String(PORT),
      // Bypass Clerk JWT verification — safe because Clerk env vars are
      // unset here (see backend/app/auth.py for the AUTH_READY gate).
      E2E_AUTH_BYPASS: "true",
      RATELIMIT_ENABLED: "false",
    },
  },
});
