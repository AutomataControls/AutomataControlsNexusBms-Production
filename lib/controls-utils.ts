// /lib/controls-utils.ts
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Save control values to Firebase
export async function saveControlValues(equipmentId, controlValues) {
  if (!equipmentId) {
    throw new Error("Equipment ID not provided");
  }

  try {
    const equipmentRef = doc(db, "equipment", equipmentId);
    
    // Update the controls field in the equipment document
    await updateDoc(equipmentRef, {
      controls: controlValues,
      lastUpdated: new Date()
    });
    
    return true;
  } catch (error) {
    console.error("Error saving control values:", error);
    throw error;
  }
}