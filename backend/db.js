import mongoose from "mongoose";
import dotenv from "dotenv";

// .env file load karne ke liye
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1); // Server band kar deta hai agar connection fail ho
  }
};

export default connectDB;
