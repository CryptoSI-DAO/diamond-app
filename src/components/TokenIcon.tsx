"use client";

import { useEffect, useState } from "react";
import { getAddress } from "viem";

/**
 * Token icon for vault cards.
 * Tries the Trust Wallet assets CDN (address-keyed, checksummed, mainnet
 * tokens only in practice) and falls back to a deterministic letter avatar:
 * first letter/number of the symbol, background color hashed from the token
 * address so each token always renders the same identity.
 * Never keyed by symbol alone (collision/phishing risk).
 */

const AVATAR_COLORS = [
  "#4da3ff", // ice
  "#a2c9ff", // ice-soft
  "#ffb547", // fee amber
  "#5fd4f4", // glacier cyan
  "#8f9bff", // periwinkle
  "#63e6be", // mint
] as const;

function hashColor(addr: string): string {
  let h = 0;
  for (let i = 2; i < addr.length; i++) {
    h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function firstGlyph(symbol: string): string {
  const m = symbol.match(/[a-zA-Z0-9]/);
  return (m ? m[0] : "?").toUpperCase();
}

export function TokenIcon({
  address,
  symbol,
  size = 40,
}: {
  address: `0x${string}`;
  symbol: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  // Checksummed address is required by the CDN path scheme.
  let checksummed = address;
  try {
    checksummed = getAddress(address);
  } catch {
    // malformed address — TWA will 404 and the avatar takes over
  }
  const cdn = `https://assets-cdn.trustwallet.com/blockchains/base/assets/${checksummed}/logo.png`;

  // Reset if the token changes under a mounted component.
  useEffect(() => {
    setFailed(false);
  }, [address]);

  if (failed) {
    const bg = hashColor(address);
    return (
      <span
        aria-hidden
        className="num flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-line"
        style={{
          width: size,
          height: size,
          background: bg,
          color: "#011526",
          fontSize: size * 0.45,
        }}
      >
        {firstGlyph(symbol)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cdn}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-card-2 object-cover ring-1 ring-line"
      style={{ width: size, height: size }}
    />
  );
}
