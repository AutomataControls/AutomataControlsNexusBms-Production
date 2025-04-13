import { Resend } from "resend"
import { formatDistanceToNow } from "date-fns"

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const {
      technicianName,
      technicianEmail,
      assignedLocations,
      action, // "added" or "updated"
    } = req.body

    if (!technicianName || !technicianEmail || !assignedLocations || !action) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Format the locations for display
    const locationsList = assignedLocations
      .map(
        (loc) =>
          `<li style="margin-bottom: 8px;">${loc.name} - ${[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}</li>`,
      )
      .join("")

    // Send email to both technician and DevOps
    const { data, error } = await resend.emails.send({
      from: "Automata BMS <noreply@automatacontrols.com>",
      to: [technicianEmail, "DevOps@automatacontrols.com"],
      subject: `Location Assignment ${action === "added" ? "Notification" : "Update"} - ${technicianName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Location Assignment ${action === "added" ? "Notification" : "Update"}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4FD1C5;
              padding: 20px;
              text-align: center;
              color: white;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 0 0 5px 5px;
              border: 1px solid #eee;
              border-top: none;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
            .logo {
              max-width: 150px;
              margin-bottom: 10px;
            }
            .button {
              display: inline-block;
              background-color: #4FD1C5;
              color: white;
              text-decoration: none;
              padding: 10px 20px;
              border-radius: 5px;
              margin-top: 15px;
            }
            .locations-list {
              background-color: white;
              border: 1px solid #eee;
              border-radius: 5px;
              padding: 15px;
              margin-top: 15px;
            }
            .social-links {
              margin-top: 15px;
            }
            .social-links a {
              display: inline-block;
              margin: 0 10px;
              color: #666;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="cid:logo" alt="Automata Controls Logo" class="logo" />
              <h1>Location Assignment ${action === "added" ? "Notification" : "Update"}</h1>
            </div>
            <div class="content">
              <p>Hello ${technicianName},</p>
              
              <p>This is a notification that you have been ${action === "added" ? "assigned to" : "updated with"} the following location(s) in the Automata Building Management System:</p>
              
              <div class="locations-list">
                <ul>
                  ${locationsList}
                </ul>
              </div>
              
              <p>You will be responsible for handling service requests and maintenance tasks at these locations.</p>
              
              <p>If you have any questions about these assignments, please contact your supervisor.</p>
              
              <a href="${process.env.APP_URL}" class="button">View Dashboard</a>
              
              <p style="margin-top: 20px; font-size: 12px; color: #666;">
                This notification was sent at ${new Date().toLocaleString()} (${formatDistanceToNow(new Date(), { addSuffix: true })}).
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Automata Controls. All rights reserved.</p>
              <div class="social-links">
                <a href="https://github.com/automatacontrols">&#x1F517; GitHub</a>
                <a href="https://gitlab.com/automatacontrols">&#x1F517; GitLab</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      attachments: [
        {
          filename: "logo.png",
          path: `${process.env.APP_URL}/images/logo.png`,
          cid: "logo",
        },
      ],
    })

    if (error) {
      console.error("Error sending email:", error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ data })
  } catch (error) {
    console.error("Error in send-technician-updates:", error)
    return res.status(500).json({ error: error.message })
  }
}
