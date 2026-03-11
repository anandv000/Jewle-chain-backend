const mongoose = require("mongoose");

let retries = 0;
const MAX_RETRIES = 3;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (Attempt ${retries + 1}/${MAX_RETRIES}): ${error.message}`);
    
    retries++;
    if (retries < MAX_RETRIES) {
      console.log(`⏳ Retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB();
    }
    
    console.error(`❌ Failed to connect to MongoDB after ${MAX_RETRIES} attempts`);
    console.error("⚠️  App will continue but database features will fail");
    // Don't exit - let app continue so we can serve other requests
    return null;
  }
};

module.exports = connectDB;
