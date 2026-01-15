module.exports = {
  apps: [
    {
      name: 'storybook-generator',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G'
    }
  ]
}
