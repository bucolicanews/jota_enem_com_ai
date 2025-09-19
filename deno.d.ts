// deno.ts

declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };
}
