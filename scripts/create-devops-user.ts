const { initializeApp } = require("firebase/app")
const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth")
const { getFirestore, doc, setDoc } = require("firebase/firestore")

// Use hardcoded config for initial setup
const firebaseConfig = {
  apiKey: "AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM",
  authDomain: "automatacontrolsneuralhvac.firebaseapp.com",
  projectId: "automatacontrolsneuralhvac",
  storageBucket: "automatacontrolsneuralhvac.firebasestorage.app",
  messagingSenderId: "805982476471",
  appId: "1:805982476471:web:7dc5dc6ad81765f51ad532",
  measurementId: "G-B8M2H1HZ55"
}

async function createDevOpsUser() {
  // Create DevOps user in Firebase Auth
  const email = "DevOps@automatacontrols.com"
  const password = "Juelz2"
  const username = "DevOps" // Set a specific username

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig)
    const auth = getAuth(app)
    const db = getFirestore(app)
    
    console.log("Creating DevOps user in Firebase Auth...")
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const firebaseUser = userCredential.user

    console.log("DevOps user created in Firebase Auth with ID:", firebaseUser.uid)

    // Add user data to Firestore with DevOps role
    console.log("Adding DevOps user data to Firestore...")
    await setDoc(doc(db, "users", firebaseUser.uid), {
      email: email,
      username: username,
      name: "Andrew",
      roles: ["admin", "user", "operator", "devops"],
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log("DevOps user data added to Firestore")
    console.log("Setup complete!")
    console.log("\nDevOps user credentials:")
    console.log("Email:", email)
    console.log("Username:", username)
    console.log("Password:", password)
  } catch (error: any) {
    if (error?.code === 'auth/email-already-in-use') {
      console.log("\nDevOps user already exists with email:", email)
      console.log("You can try logging in with:")
      console.log("Email:", email)
      console.log("Username:", username)
      console.log("Password:", password)
    } else {
      console.error("Error creating DevOps user:", error)
    }
  }
}

createDevOpsUser() 