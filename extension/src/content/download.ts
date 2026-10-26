/** A Sobrus export, read with the page's session, its size reported while it arrives (a year of sales
 *  is several Mo: without it the card looks stuck). */
export async function downloadText(url: string, onBytes: (bytes: number) => void): Promise<string> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  let shownAt = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    bytes += value.length;
    if (Date.now() - shownAt > 150) {
      shownAt = Date.now();
      onBytes(bytes);
    }
  }
  onBytes(bytes);
  const all = new Uint8Array(bytes);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return new TextDecoder("utf-8").decode(all);
}
