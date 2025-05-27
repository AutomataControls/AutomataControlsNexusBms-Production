import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore"
import { auth } from "@/lib/firebase"
import { deleteUser } from "firebase/auth"

export default async function handler(req, res) {
  console.log("👤 Reject User API route called")

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { userId, email } = req.query

  if (!userId || !email) {
    console.error("👤 ERROR: Missing userId or email")
    return res.status(400).json({ error: "userId and email are required" })
  }

  console.log(`👤 Rejecting user: ${userId} (${email})`)

  try {
    const db = getFirestore()
    
    // Get the user document
    const userDocRef = doc(db, "users", userId)
    const userDoc = await getDoc(userDocRef)
    
    if (!userDoc.exists()) {
      console.error(`👤 ERROR: User document not found for ID: ${userId}`)
      return res.status(404).json({ error: "User not found" })
    }
    
    // Update the user document to mark as rejected
    await updateDoc(userDocRef, {
      rejected: true,
      rejectedAt: new Date(),
      updatedAt: new Date()
    })
    
    console.log(`👤 User document updated successfully: ${userId}`)
    
    // Send rejection email to the user
    try {
      // Get the user's auth object
      const user = auth.currentUser
      
      if (user) {
        // Send rejection email
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/api/send-rejection-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: userDoc.data().name,
            email: email,
            username: userDoc.data().username,
          }),
        })
        
        if (!response.ok) {
          throw new Error(`Failed to send rejection email: ${response.statusText}`)
        }
        
        console.log(`👤 Rejection email sent to: ${email}`)
        
        // Delete the user from Firebase Auth
        try {
          await deleteUser(user)
          console.log(`👤 User deleted from Firebase Auth: ${userId}`)
        } catch (deleteError) {
          console.error("👤 ERROR deleting user from Firebase Auth:", deleteError)
          // Continue with the rejection process even if deletion fails
        }
      } else {
        console.error("👤 ERROR: No authenticated user found")
      }
    } catch (emailError) {
      console.error("👤 ERROR sending rejection email:", emailError)
      // Continue with the rejection process even if email fails
    }
    
    // Redirect to a success page
    res.redirect(302, `${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/rejection-success?userId=${userId}`)
  } catch (error) {
    console.error("👤 ERROR rejecting user:", error)
    res.redirect(302, `${process.env.NEXT_PUBLIC_APP_URL || 'https://neuralbms.automatacontrols.com'}/rejection-error?error=${encodeURIComponent(error.message)}`)
  }
} 
