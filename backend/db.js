// backend/db.js
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);
let db;

export async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    console.log(`Connected to MongoDB: ${process.env.DB_NAME}`);
  }
  return db;
}
