/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_E2E_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
