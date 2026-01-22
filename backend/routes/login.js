// backend/routes/login.js
import bcrypt from 'bcrypt';
import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e password obbligatorie' });
    }

    // Trasforma l'email in lowercase per il controllo
    email = email.toLowerCase();

    const db = await getDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenziali non valide' });
    }

    // ---- CONFRONTO HASH ----
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Credenziali non valide' });
    }

    // Login riuscito: ritorna i dati dell’utente (senza password)
    const { password: _, ...userData } = user;

    res.json({ success: true, user: userData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Errore server' });
  }
});

export default router;
