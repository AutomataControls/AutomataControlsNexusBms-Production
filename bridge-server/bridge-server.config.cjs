module.exports = {
  apps: [
    {
      name: "bridge-server",
      script: "./dist/index.js", // Change this to the compiled JavaScript file
      interpreter: "node", // Node.js interpreter for running the file
      watch: false, // Don't watch for file changes, especially in production
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
