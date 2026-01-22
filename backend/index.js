import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';

import googleRouter from './routes/google.js';
import loginRoute from "./routes/login.js";
import registerRoute from "./routes/register.js";
import groupsRoute from "./routes/groups.js";
import usersRoute from "./routes/users.js";
import expensesRoute from "./routes/expenses.js";


dotenv.config();

const app = express();

// Configurazione per ottenere __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: ['http://localhost:8081', 'http://10.178.160.160:3000', 'exp://*'],
  credentials: true
}));
app.use(express.json());

// Servi file statici dalla cartella uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use("/api/expenses", expensesRoute);
app.use('/auth/google', googleRouter);
app.use("/login", loginRoute);
app.use("/register", registerRoute);
app.use("/api/groups", groupsRoute);
app.use("/api/users", usersRoute);

// Route di test
app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

// Crea la cartella uploads se non esiste
import fs from 'fs';
const uploadsDir = path.join(__dirname, 'uploads');
const groupsUploadsDir = path.join(__dirname, 'uploads', 'groups');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Cartella uploads creata');
}

if (!fs.existsSync(groupsUploadsDir)) {
  fs.mkdirSync(groupsUploadsDir, { recursive: true });
  console.log('Cartella uploads/groups creata');
}

// Gestione errori 404
app.use((req, res) => {
  res.status(404).json({ 
    error: "Route not found",
    path: req.path,
    method: req.method 
  });
});

// Gestione errori generici
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Uploads disponibili su http://localhost:${PORT}/uploads/`);
  console.log(`Also accessible on network IPs`);
});