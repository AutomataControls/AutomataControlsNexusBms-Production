// Script to verify that the logo file is accessible
const fs = require("fs")
const path = require("path")

// Check if the logo exists in the public directory
const logoPath = path.join(__dirname, "..", "public", "neural-loader.png")

console.log(`Checking if logo exists at: ${logoPath}`)

if (fs.existsSync(logoPath)) {
  console.log("✅ Logo file exists!")

  // Get file stats
  const stats = fs.statSync(logoPath)
  console.log(`File size: ${stats.size} bytes`)
  console.log(`Last modified: ${stats.mtime}`)

  console.log("The logo should be accessible at: /neural-loader.png")
} else {
  console.log("❌ Logo file does not exist!")
  console.log("Please make sure the logo file is placed in the public directory.")
}
