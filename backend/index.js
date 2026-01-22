import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import googleRouter from "./routes/google.js";
import loginRoute from "./routes/login.js";
import registerRoute from "./routes/register.js";
import groupsRoute from "./routes/groups.js";
import usersRoute from "./routes/users.js";
import expensesRoute from "./routes/expenses.js";

dotenv.config();

const app = express();

// __dirname per ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS corretto per Expo + Render
app.use(cors());
app.use(express.json());

// Static uploads (TEMPORANEO su Render)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/expenses", expensesRoute);
app.use("/auth/google", googleRouter);
app.use("/login", loginRoute);
app.use("/register", registerRoute);
app.use("/api/groups", groupsRoute);
app.use("/api/users", usersRoute);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

// Crea cartelle uploads (solo runtime)
const uploadsDir = path.join(__dirname, "uploads/groups");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 404
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error"
  });
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
