/*import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { email, username, name, surname } = req.body;
    const db = await getDb();
    const users = db.collection('users');

    let user = await users.findOne({ email });
    if (!user) {
      const result = await users.insertOne({
        email,
        username,
        name,
        surname,
        provider: 'facebook',
        createdAt: new Date(),
      });
      user = { _id: result.insertedId, email, username, name, surname };
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Errore autenticazione Facebook' });
  }
});

export default router;*/
