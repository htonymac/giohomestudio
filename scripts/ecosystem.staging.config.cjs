// PM2 ecosystem config for GHS staging on port 3201.
// Used to keep `pnpm dev -p 3201` alive after a SIGHUP / SSH session close.
//
// Install once:  npm i -g pm2
// Start:         pm2 start scripts/ecosystem.staging.config.cjs
// Save:          pm2 save           (persists across server reboot via pm2 startup)
// Logs:          pm2 logs ghs-staging
// Restart:       pm2 restart ghs-staging
// Status:        pm2 ls
//
// Replaces the manual `setsid bash -c "nohup pnpm dev -p 3201 ..."` pattern that
// died on idle. PM2 monitors the process + auto-restarts on crash + survives
// SSH session termination cleanly.

module.exports = {
  apps: [
    {
      name: "ghs-staging",
      cwd: "/home/ghs/giohomestudio-staging",
      script: "pnpm",
      args: "dev -p 3201",
      interpreter: "none",                 // pnpm is a script, not Node directly
      env: {
        NODE_ENV: "development",
        PORT: "3201",
      },
      out_file: "/tmp/ghs-staging-out.log",
      error_file: "/tmp/ghs-staging-err.log",
      merge_logs: true,
      time: true,
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: "60s",        // count as crashed only if process dies inside first 60s
      restart_delay: 4000,      // 4s between restart attempts
      // Memory ceiling — kill + restart if Next.js dev leaks past this
      max_memory_restart: "2G",
    },
  ],
};
