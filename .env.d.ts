declare module 'bun' {
  interface Env {
    PORT: number | undefined;
    NEIS_API_KEY: string;
    GOOGLE_CLIENT_ID: string;
    ADMIN_KEY: string;
  }
}
