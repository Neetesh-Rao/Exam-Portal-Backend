import mongoose from "mongoose";

let cachedPromise: Promise<typeof mongoose> | null = null;

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hiring-platform";

  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (!cachedPromise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    cachedPromise = mongoose.connect(uri, opts);
  }

  try {
    await cachedPromise;
    console.log("Connected to MongoDB successfully");
    return mongoose.connection;
  } catch (error) {
    cachedPromise = null;
    console.error("MongoDB connection error:", error);
    throw error;
  }
}
