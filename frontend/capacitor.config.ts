import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dlwhyte.reed",
  appName: "BrowseFellow",
  webDir: "dist",
  server: {
    // Load the live web app directly so the WebView origin matches the
    // API origin — required for Clerk session cookies + OAuth + CORS to
    // work inside Capacitor. Frontend updates ship via the server; no
    // Capacitor rebuild needed for FE-only changes.
    url: "https://browsefellow.com",
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
