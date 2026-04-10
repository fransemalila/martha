module.exports = {
  apps: [
    {
      name: "treasury-api",
      script: "./backend/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production"
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
