// Save as test-nodemailer-variants.js
const nodemailer = require("nodemailer");

async function testNodemailer() {
  const email = "ayouremail";
  const password = "apppassword"; // Replace with your app password
  const recipient = "your-email";
  
  const configurations = [
    {
      name: "Standard Configuration (587)",
      config: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: email, pass: password },
        timeout: 60000, // 60 second timeout
      },
    },
    {
      name: "Secure Configuration (465)",
      config: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: email, pass: password },
        timeout: 60000,
      },
    },
    {
      name: "Alternative Port (2525)",
      config: {
        host: "smtp.gmail.com",
        port: 2525,
        secure: false,
        auth: { user: email, pass: password },
        timeout: 60000,
      },
    },
    {
      name: "Direct Gmail Service",
      config: {
        service: "gmail",
        auth: { user: email, pass: password },
        timeout: 60000,
      },
    },
  ];

  for (const { name, config } of configurations) {
    console.log(`\nTesting ${name}...`);
    
    try {
      const transporter = nodemailer.createTransport(config);
      
      console.log("Attempting to verify connection...");
      try {
        await transporter.verify();
        console.log("✅ Connection verified successfully!");
      } catch (verifyError) {
        console.error("❌ Connection verification failed:", verifyError.message);
        continue; // Skip to next configuration
      }
      
      console.log("Sending test email...");
      const info = await transporter.sendMail({
        from: `"Test" <${email}>`,
        to: recipient,
        subject: `Test from ${name}`,
        text: `This is a test email from ${name} configuration.`,
        html: `<p>This is a test email from <b>${name}</b> configuration.</p>`,
      });
      
      console.log("✅ Email sent successfully!");
      console.log("Message ID:", info.messageId);
      return { success: true, config: name };
    } catch (error) {
      console.error("❌ Error:", error.message);
    }
  }
  
  console.log("\n❌ All configurations failed.");
  return { success: false };
}

testNodemailer()
  .then(result => {
    console.log("\nFinal result:", result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error("Uncaught error:", error);
    process.exit(1);
  });
