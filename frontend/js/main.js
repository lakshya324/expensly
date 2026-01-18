import { dbManager } from "./models/database.js";

async function initDB() {
  try {
    await dbManager.init();
    console.log("Expensly storage ready");
  } catch (error) {
    console.error("Failed to initialize storage:", error);
    alert("Failed to initialize app storage. Please refresh the page.");
  }
}
initDB();