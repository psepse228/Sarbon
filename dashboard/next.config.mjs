/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Telegram Mini Apps are loaded inside a webview via <iframe>-like context;
  // no special headers are required today, but if X-Frame-Options ever gets
  // added upstream (e.g. via a hosting default), it must allow Telegram's origin.
};

export default nextConfig;
