import type { PublicClient } from "viem";
import type { AbiEvent, Log } from "viem";

/**
 * Chunked eth_getLogs that ADAPTS to each RPC's range cap.
 *
 * Learned 2026-10-05: Base's official RPC (mainnet.base.org, used by wagmi's
 * `http()` transport) hard-caps eth_getLogs at a 2,000-block range (-32614
 * "eth_getLogs is limited to a 2,000 range"). Both useVaultCreators and
 * useGlobalStats scanned in fixed 9,000-block chunks → every chunk rejected →
 * whole scan threw → zero creators → the Curated tab was permanently empty on
 * Base mainnet (Sepolia worked only because its scanned span was small).
 *
 * Strategy: start at 2,000 (strictest known mainnet cap), halve on range
 * errors (min 100), double back up toward chunkStart after clean chunks.
 * One transient-error retry per chunk before giving up.
 */

const MIN_CHUNK = 100;
const RETRIES_PER_CHUNK = 2;

function isRangeCapError(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  return /range|limit|-32614|413|too many|exceed/i.test(s);
}

export async function scanLogs<E extends AbiEvent>(
  pc: PublicClient,
  params: {
    address: `0x${string}` | `0x${string}`[];
    event: E;
    fromBlock: bigint;
    toBlock: bigint;
    /** Initial chunk size — defaults to the strictest known cap. */
    chunkStart?: number;
  }
): Promise<Array<Log<bigint, number, false, E, true>>> {
  const { address, event, fromBlock, toBlock, chunkStart = 2_000 } = params;
  const out: Array<Log<bigint, number, false, E, true>> = [];
  let chunk = chunkStart;
  let start = fromBlock;

  while (start <= toBlock) {
    const end = start + BigInt(chunk - 1) > toBlock ? toBlock : start + BigInt(chunk - 1);
    try {
      const logs = await pc.getLogs({ address, event, fromBlock: start, toBlock: end });
      out.push(...(logs as Array<Log<bigint, number, false, E, true>>));
      start = end + 1n;
      // clean chunk — grow back toward the initial size
      chunk = Math.min(chunkStart, chunk * 2);
    } catch (e) {
      if (isRangeCapError(e) && chunk > MIN_CHUNK) {
        chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
        continue; // retry SAME range, smaller
      }
      // transient failure — limited retries, same range
      let done = false;
      for (let i = 0; i < RETRIES_PER_CHUNK && !done; i++) {
        await new Promise((r) => setTimeout(r, 400));
        try {
          const logs = await pc.getLogs({ address, event, fromBlock: start, toBlock: end });
          out.push(...(logs as Array<Log<bigint, number, false, E, true>>));
          start = end + 1n;
          chunk = Math.min(chunkStart, chunk * 2);
          done = true;
        } catch {
          /* fall through to next retry */
        }
      }
      if (!done) throw e;
    }
  }
  return out;
}

/**
 * Forward probe for the FIRST event of `event`, capped at `maxChunks` chunks.
 * Used to find the earliest block at which any vault existed so event scans
 * (e.g. TaxCollected) can start there instead of at the factory deploy block —
 * turns a multi-minute scan into seconds while a protocol is young.
 * Returns the block of the first hit, or null if nothing within the cap.
 */
export async function probeFirstEventBlock(
  pc: PublicClient,
  params: {
    address: `0x${string}` | `0x${string}`[];
    event: AbiEvent;
    fromBlock: bigint;
    toBlock: bigint;
    chunkStart?: number;
    maxChunks?: number;
  }
): Promise<bigint | null> {
  const { address, event, fromBlock, toBlock, chunkStart = 2_000, maxChunks = 100 } = params;
  let chunk = chunkStart;
  let start = fromBlock;
  let chunks = 0;

  while (start <= toBlock && chunks < maxChunks) {
    const end = start + BigInt(chunk - 1) > toBlock ? toBlock : start + BigInt(chunk - 1);
    chunks++;
    try {
      const logs = await pc.getLogs({ address, event, fromBlock: start, toBlock: end });
      if (logs.length > 0) return (logs[0] as Log).blockNumber ?? start;
      start = end + 1n;
      chunk = Math.min(chunkStart, chunk * 2);
    } catch (e) {
      if (isRangeCapError(e) && chunk > MIN_CHUNK) {
        chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
        continue;
      }
      throw e;
    }
  }
  return null;
}
