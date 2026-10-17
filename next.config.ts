import "dotenv/config"
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  logging: {
    // Dev logs would otherwise print Server Function arguments, including passwords from auth forms.
    serverFunctions: false,
  },
};

export default nextConfig;
