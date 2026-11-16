// TypeScript browser/test project declaration for the Deno runtime used by imported Edge Function modules.
declare const Deno: { env: { get(name: string): string | undefined } };
