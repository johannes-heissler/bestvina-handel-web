/**
 * Sharing a session as a link: the saved session (start + moves) as JSON, compressed with deflate and written in
 * base64url, in the part of the address after `#` (so it never reaches a server). Uses the standard
 * `CompressionStream`, available in browsers and Node.
 *
 * @module
 */
import type { SessionFile } from "./session";

const PREFIX = "s=";

/** The fragment (without "#") that encodes the session. */
export async function encodeSession(file: SessionFile): Promise<string> {
  const bytes = await transform(
    new TextEncoder().encode(JSON.stringify(file)),
    new CompressionStream("deflate-raw"),
  );
  return PREFIX + toBase64Url(bytes);
}

/** The session in a fragment made by {@link encodeSession}, or undefined if the fragment holds none. */
export async function decodeSession(fragment: string): Promise<SessionFile | undefined> {
  const text = fragment.replace(/^#/, "");
  if (!text.startsWith(PREFIX)) return undefined;
  const bytes = await transform(
    fromBase64Url(text.slice(PREFIX.length)),
    new DecompressionStream("deflate-raw"),
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as SessionFile;
}

async function transform(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const output = new Blob([input as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
