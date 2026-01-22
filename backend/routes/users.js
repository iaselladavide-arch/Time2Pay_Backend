import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// -------- CONFIGURAZIONE MULTER PER IMMAGINI PROFILO --------
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/profiles';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const userId = req.params.userId;
    cb(null, 'profile-' + userId + '-' + uniqueSuffix + ext);
  }
});

const profileFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo file immagini sono permessi!'));
  }
};

const uploadProfile = multer({ 
  storage: profileStorage,
  fileFilter: profileFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024 // Limite 3MB
  }
});

// -------- MIDDLEWARE DI AUTENTICAZIONE --------
const authenticate = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Autenticazione richiesta' 
      });
    }
    
    const db = await getDb();
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(userId) 
    });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Utente non trovato' 
      });
    }
    
    req.userId = userId;
    req.user = user;
    next();
  } catch (error) {
    console.error('Errore autenticazione:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server' 
    });
  }
};

// -------- ENDPOINTS --------

// Cerca utenti per username, nome o cognome
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Inserisci almeno 2 caratteri per la ricerca'
      });
    }

    const db = await getDb();
    const searchRegex = new RegExp(q.trim(), 'i');
    
    const users = await db.collection('users').find({
      $or: [
        { username: searchRegex },
        { name: searchRegex },
        { surname: searchRegex },
        { email: searchRegex }
      ],
      // Escludi l'utente corrente dalla ricerca
      _id: { $ne: new ObjectId(req.userId) }
    })
    .project({
      password: 0,
      groups: 0
    })
    .limit(20)
    .toArray();

    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        surname: user.surname,
        profileImage: user.profileImage || null,
        fullName: `${user.name} ${user.surname}`.trim()
      }))
    });

  } catch (error) {
    console.error('Errore ricerca utenti:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni informazioni di un utente specifico per username
router.get('/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { username: username.toLowerCase() },
      { projection: { password: 0, groups: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        surname: user.surname,
        profileImage: user.profileImage || null
      }
    });

  } catch (error) {
    console.error('Errore recupero utente:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni dettagli utente per ID (singolo)
router.get('/id/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente non valido'
      });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, groups: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name || '',
        surname: user.surname || '',
        profileImage: user.profileImage || null
      }
    });

  } catch (error) {
    console.error('Errore recupero utente per ID:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni batch di utenti per ID (per ottimizzare le chiamate)
router.post('/batch', authenticate, async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Fornire un array di ID utente'
      });
    }

    // Valida e converte gli ID
    const validIds = [];
    for (const id of userIds) {
      if (ObjectId.isValid(id)) {
        validIds.push(new ObjectId(id));
      }
    }

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun ID utente valido fornito'
      });
    }

    const db = await getDb();
    const users = await db.collection('users').find(
      { _id: { $in: validIds } },
      { projection: { password: 0, groups: 0 } }
    ).toArray();

    // Crea una mappa per accesso rapido
    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id.toString()] = {
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name || '',
        surname: user.surname || '',
        profileImage: user.profileImage || null
      };
    });

    res.json({
      success: true,
      users: usersMap
    });

  } catch (error) {
    console.error('Errore recupero batch utenti:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Aggiorna profilo utente
router.put('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente non valido'
      });
    }

    // Verifica che l'utente stia modificando i propri dati
    if (userId !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Puoi modificare solo il tuo profilo' 
      });
    }

    const db = await getDb();
    
    // Se sta cambiando username, controlla che non sia già in uso
    if (updates.username) {
      const existingUser = await db.collection('users').findOne({ 
        username: updates.username,
        _id: { $ne: new ObjectId(userId) }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username già in uso'
        });
      }
    }

    // Se sta cambiando email, controlla che non sia già in uso
    if (updates.email) {
      const existingUser = await db.collection('users').findOne({ 
        email: updates.email.toLowerCase(),
        _id: { $ne: new ObjectId(userId) }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email già in uso'
        });
      }
      
      updates.email = updates.email.toLowerCase();
    }

    // Aggiorna il database
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: updates }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessuna modifica apportata'
      });
    }

    // Ottieni l'utente aggiornato
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    res.json({
      success: true,
      message: 'Profilo aggiornato con successo',
      user: updatedUser
    });

  } catch (error) {
    console.error('Errore aggiornamento profilo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// -------- GESTIONE IMMAGINE PROFILO --------

// Upload immagine profilo
router.post('/:userId/upload-profile-image', authenticate, uploadProfile.single('image'), async (req, res) => {
  try {
    console.log('=== UPLOAD PROFILE IMAGE ===');
    console.log('User ID from params:', req.params.userId);
    console.log('Authenticated user ID:', req.userId);
    console.log('File received:', req.file ? 'YES' : 'NO');
    console.log('File details:', req.file);
    
    const { userId } = req.params;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente non valido'
      });
    }

    if (!req.file) {
      console.log('No file received in request');
      return res.status(400).json({ 
        success: false, 
        error: 'Nessun file immagine fornito' 
      });
    }

    // Verifica che l'utente stia caricando la propria immagine
    if (userId !== req.userId) {
      console.log('User ID mismatch:', { params: userId, auth: req.userId });
      // Cancella il file caricato
      if (req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Errore cancellazione file:', err);
        });
      }
      
      return res.status(403).json({ 
        success: false,
        error: 'Puoi caricare solo la tua immagine profilo' 
      });
    }

    const db = await getDb();
    
    // Costruisci l'URL dell'immagine
    const baseUrl = req.protocol + '://' + req.get('host');
    const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;
    
    console.log('Generated image URL:', imageUrl);

    // Aggiorna l'utente con l'URL dell'immagine
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          profileImage: imageUrl,
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Impossibile aggiornare l\'immagine profilo' 
      });
    }

    // Ottieni l'utente aggiornato per la risposta
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    console.log('Upload successful, updated user:', updatedUser._id);

    res.json({
      success: true,
      message: 'Immagine profilo aggiornata con successo',
      imageUrl: imageUrl,
      user: updatedUser
    });

  } catch (error) {
    console.error('Errore upload immagine profilo:', error);
    
    // Cancella il file se c'è stato un errore
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Errore cancellazione file:', err);
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server durante l\'upload dell\'immagine' 
    });
  }
});

// Ottieni immagine profilo
router.get('/:userId/profile-image', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente non valido'
      });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { profileImage: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    res.json({
      success: true,
      profileImage: user.profileImage || null
    });

  } catch (error) {
    console.error('Errore recupero immagine profilo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Rimuovi immagine profilo
router.delete('/:userId/remove-profile-image', authenticate, async (req, res) => {
  try {
    console.log('=== REMOVE PROFILE IMAGE ===');
    console.log('User ID from params:', req.params.userId);
    console.log('Authenticated user ID:', req.userId);
    
    const { userId } = req.params;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente non valido'
      });
    }

    // Verifica che l'utente stia rimuovendo la propria immagine
    if (userId !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Puoi rimuovere solo la tua immagine profilo' 
      });
    }

    const db = await getDb();
    
    // Prima ottieni l'utente per vedere se ha un'immagine
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { profileImage: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // Se l'utente ha un'immagine, cancella il file
    if (user.profileImage) {
      try {
        const imagePath = user.profileImage.replace(/.*\/uploads\/profiles\//, './uploads/profiles/');
        console.log('Attempting to delete image at:', imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log('Image file deleted successfully');
        } else {
          console.log('Image file not found at path:', imagePath);
        }
      } catch (fileError) {
        console.error('Errore cancellazione file immagine:', fileError);
        // Continua comunque
      }
    }

    // Rimuovi l'immagine dal database
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $unset: { profileImage: "" },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Impossibile rimuovere l\'immagine profilo' 
      });
    }

    // Ottieni l'utente aggiornato per la risposta
    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    res.json({
      success: true,
      message: 'Immagine profilo rimossa con successo',
      user: updatedUser
    });

  } catch (error) {
    console.error('Errore rimozione immagine profilo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server durante la rimozione dell\'immagine' 
    });
  }
});

// Elimina account utente (completo)
router.delete('/:userId/delete-account', authenticate, async (req, res) => {
  try {
    console.log('=== DELETE ACCOUNT ===');
    console.log('User ID from params:', req.params.userId);
    console.log('Authenticated user ID:', req.userId);
    
    const { userId } = req.params;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: 'ID utente non valido'
      });
    }

    // Verifica che l'utente stia eliminando il proprio account
    if (userId !== req.userId) {
      return res.status(403).json({ 
        success: false,
        error: 'Puoi eliminare solo il tuo account' 
      });
    }

    const db = await getDb();
    
    // PRIMA: Ottieni tutti i dati dell'utente per possibili operazioni di pulizia
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { profileImage: 1, groups: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utente non trovato'
      });
    }

    // 1. Se l'utente ha un'immagine profilo, cancellala
    if (user.profileImage) {
      try {
        const imagePath = user.profileImage.replace(/.*\/uploads\/profiles\//, './uploads/profiles/');
        console.log('Attempting to delete profile image at:', imagePath);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log('Profile image file deleted successfully');
        } else {
          console.log('Profile image file not found at path:', imagePath);
        }
      } catch (fileError) {
        console.error('Errore cancellazione immagine profilo:', fileError);
        // Continua comunque con l'eliminazione
      }
    }

    // 2. Gestisci i gruppi di cui l'utente è membro
    if (user.groups && user.groups.length > 0) {
      try {
        // Per ogni gruppo, rimuovi l'utente dalla lista dei membri
        for (const groupId of user.groups) {
          await db.collection('groups').updateOne(
            { _id: new ObjectId(groupId) },
            { 
              $pull: { members: new ObjectId(userId) },
              $set: { updatedAt: new Date() }
            }
          );
          
          // Controlla se il gruppo è vuoto dopo aver rimosso l'utente
          const group = await db.collection('groups').findOne(
            { _id: new ObjectId(groupId) }
          );
          
          // Se il gruppo non ha più membri, eliminalo completamente
          if (group && (!group.members || group.members.length === 0)) {
            await db.collection('groups').deleteOne({ _id: new ObjectId(groupId) });
            console.log(`Gruppo ${groupId} eliminato perché vuoto`);
            
            // Elimina anche le spese associate al gruppo
            await db.collection('expenses').deleteMany({ groupId: groupId });
            console.log(`Spese del gruppo ${groupId} eliminate`);
          }
        }
      } catch (groupsError) {
        console.error('Errore gestione gruppi durante eliminazione account:', groupsError);
        // Continua comunque con l'eliminazione dell'utente
      }
    }

    // 3. Elimina tutte le spese create dall'utente
    try {
      const expensesResult = await db.collection('expenses').deleteMany({ 
        'paidBy.userId': new ObjectId(userId) 
      });
      console.log(`Eliminate ${expensesResult.deletedCount} spese create dall'utente`);
    } catch (expensesError) {
      console.error('Errore eliminazione spese:', expensesError);
    }

    // 4. Rimuovi l'utente dalle spese in cui è coinvolto come partecipante
    try {
      // Trova tutte le spese dove l'utente è un partecipante
      const expensesWithUser = await db.collection('expenses').find({
        'participants.userId': new ObjectId(userId)
      }).toArray();
      
      // Per ogni spesa, rimuovi l'utente dai partecipanti
      for (const expense of expensesWithUser) {
        await db.collection('expenses').updateOne(
          { _id: expense._id },
          { 
            $pull: { 
              participants: { userId: new ObjectId(userId) } 
            },
            $set: { updatedAt: new Date() }
          }
        );
      }
      console.log(`Utente rimosso da ${expensesWithUser.length} spese come partecipante`);
    } catch (participantsError) {
      console.error('Errore rimozione utente da partecipanti:', participantsError);
    }

    // 5. Finalmente elimina l'utente dalla collezione users
    const result = await db.collection('users').deleteOne({
      _id: new ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Impossibile eliminare l\'account' 
      });
    }

    console.log('Account eliminato con successo:', userId);

    res.json({
      success: true,
      message: 'Account eliminato con successo. Tutti i tuoi dati sono stati rimossi.',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Errore eliminazione account:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server durante l\'eliminazione dell\'account' 
    });
  }
});

export default router;