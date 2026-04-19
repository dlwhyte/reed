import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dlwhyte.reed",
  appName: "reed",
  webDir: "dist",
  server: {
    // Allow the WKWebView to reach reed's backend over plain HTTP (Tailscale).
    androidScheme: "https",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
