import 'server-only';

const USER_AGENT = 'Catholica/1.0 (personal use)';
const TIMEOUT_MS = 15_000;

/** A source answered with a non-2xx status (or could not be reached, status 0). */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

async function get(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new SourceError(`GET ${url} failed: ${e instanceof Error ? e.message : String(e)}`, 0);
  }
  if (!res.ok) throw new SourceError(`GET ${url} returned ${res.status}`, res.status);
  return res;
}

export async function fetchText(url: string): Promise<string> {
  return (await get(url)).text();
}

export async function fetchBytes(url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await get(url)).arrayBuffer());
}
