// .env 파일 로드
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'storybook-generator',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
}
