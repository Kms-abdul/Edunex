
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LOG_API?: string;
  /** Optional: the address parents open admission-form links at (default: the address the app is opened at). */
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
