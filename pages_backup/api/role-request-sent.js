export default function handler(req, res) {
  console.log("📧 Role request confirmation page accessed")

  // HTML for a simple confirmation page
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Role Upgrade Request Sent</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #1a1a1a;
          color: #e0e0e0;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          padding: 20px;
          text-align: center;
        }
        .container {
          max-width: 600px;
          background-color: #2a2a2a;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        h1 {
          color: #00FFEA;
          margin-bottom: 20px;
        }
        p {
          font-size: 18px;
          line-height: 1.6;
          margin-bottom: 25px;
        }
        .button {
          display: inline-block;
          background: linear-gradient(to right, rgba(0, 255, 234, 0.8), rgba(0, 255, 234, 0.6));
          color: #000;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-weight: bold;
          transition: all 0.3s ease;
        }
        .button:hover {
          background: linear-gradient(to right, rgba(0, 255, 234, 1), rgba(0, 255, 234, 0.8));
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Role Upgrade Request Sent</h1>
        <p>Your request for elevated access has been sent to the Automata Controls DevOps team.</p>
        <p>They will review your request and update your account permissions if approved.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://neuralbms.automatacontrols.com"}" class="button">Return to Dashboard</a>
      </div>
    </body>
    </html>
  `

  // Set the content type to HTML
  res.setHeader("Content-Type", "text/html")

  // Send the HTML response
  res.status(200).send(html)
}

