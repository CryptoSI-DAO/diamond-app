/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // EVM-only app: stub the Solana x402 client that @coinbase/cdp-sdk
    // statically imports (via @base-org/account) but never runs here.
    config.resolve.alias["@x402/svm/exact/client"] = false;
    return config;
  },
};

export default nextConfig;
