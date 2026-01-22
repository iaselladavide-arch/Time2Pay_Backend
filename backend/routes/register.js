import bcrypt from 'bcrypt';
import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // Converto la mail in minuscolo
    const email = req.body.email?.toLowerCase();
    const { password, username, name, surname } = req.body;

    if (!email || !password || !username || !name || !surname) {
      return res.status(400).json({ success: false, error: 'Tutti i campi sono obbligatori' });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    const existing = await usersCollection.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email già registrata' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      username,
      name,
      surname,
      createdAt: new Date()
    });

    res.json({ success: true, userId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Errore del server' });
  }
});

export default router;
