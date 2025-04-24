import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore"
import { auth } from "@/lib/firebase"
import { sendEmailVerification } from "firebase/auth"

export default async function handler(req, res) {
  console.log("👤 Approve User API route called")

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { userId, email } = req.query

  if (!userId || !email) {
    console.error("👤 ERROR: Missing userId or email")
    return res.status(400).json({ error: "userId and email are required" })
  }

  console.log(`👤 Approving user: ${userId} (${email})`)

  try {
    const db = getFirestore()
    
    // Get the user document
    const userDocRef = doc(db, "users", userId)
    const userDoc = await getDoc(userDocRef)
    
    if (!userDoc.exists()) {
      console.error(`👤 ERROR: User document not found for ID: ${userId}`)
      return res.status(404).json({ error: "User not found" })
    }
    
    // Update the user document to mark as approved
    await updateDoc(userDocRef, {
      approved: true,
      approvedAt: new Date(),
      updatedAt: new Date()
    })
    
    console.log(`👤 User document updated successfully: ${userId}`)
    
    // Send welcome email to the user
    try {
      // Get the user's auth object
      const user = auth.currentUser
      
      if (user) {
        // Send email verification
        await sendEmailVerification(user)
        console.log(`👤 Email verification sent to: ${email}`)
        
        // Send welcome email
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/api/send-signup-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: userDoc.data().name,
            email: email,
            username: userDoc.data().username,
            location: userDoc.data().assignedLocations?.[0] || "",
            locationName: userDoc.data().locationName || "",
          }),
        })
        
        if (!response.ok) {
          throw new Error(`Failed to send welcome email: ${response.statusText}`)
        }
        
        console.log(`👤 Welcome email sent to: ${email}`)
      } else {
        console.error("👤 ERROR: No authenticated user found")
      }
    } catch (emailError) {
      console.error("👤 ERROR sending welcome email:", emailError)
      // Continue with the approval process even if email fails
    }
    
    // Redirect to a success page
    res.redirect(302, `${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/approval-success?userId=${userId}`)
  } catch (error) {
    console.error("👤 ERROR approving user:", error)
    res.redirect(302, `${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/approval-error?error=${encodeURIComponent(error.message)}`)
  }
} 
