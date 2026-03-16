/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "soyuz-api",
      cwd: __dirname,
      script: "node",
      args: "apps/server/dist/index.js",
      env: { NODE_ENV: "production" },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
    },
  ],
};
