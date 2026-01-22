// backend/routes/google.js
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from '../db.js';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) return res.status(400).json({ success: false, error: 'Token mancante' });

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.given_name || '';
    const surname = payload.family_name || '';
    const username = email.split('@')[0];

    const db = await getDb();
    const users = db.collection('users');

    let user = await users.findOne({ email });

    if (!user) {
      const result = await users.insertOne({
        email,
        username,
        name,
        surname,
        provider: 'google',
        createdAt: new Date(),
      });

      user = {
        _id: result.insertedId,
        email,
        username,
        name,
        surname,
      };
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error('Errore Google login:', err);
    res.status(500).json({ success: false, error: 'Errore autenticazione Google' });
  }
});

export default router;
