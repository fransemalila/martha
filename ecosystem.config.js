module.exports = {
  apps: [
    {
      name: "treasury-api",
      script: "./backend/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        DATA_DIR: "/opt/treasury-dashboard/data",
        UPLOAD_PASSWORD: "changeme",
        CORS_ORIGINS: "http://dashboard.example.com,http://upload.example.com"
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
