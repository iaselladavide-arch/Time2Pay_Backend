import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { groupHelpers } from '../model/group.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configurazione multer per il salvataggio delle immagini
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/groups';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'group-' + req.params.groupId + '-' + uniqueSuffix + ext);
  }
});

// Filtro per accettare solo immagini
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Solo file immagini sono permessi!'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// Helper function per formattare la risposta utente
const formatUserResponse = (user) => {
  return {
    _id: user._id,
    username: user.username,
    name: user.name || user.username,
    surname: user.surname || '',
    email: user.email || '',
    profileImage: user.profileImage || null
  };
};

// Middleware di autenticazione semplice
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

// Crea nuovo gruppo
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const creatorId = req.userId;

    const validation = groupHelpers.validateGroup({ name });
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');
    const groupsCollection = db.collection('groups');

    const memberUsernames = Array.isArray(members) ? members : [];
    
    if (memberUsernames.length > 0) {
      const memberUsers = await usersCollection.find({ 
        username: { $in: memberUsernames } 
      }).toArray();

      const foundUsernames = memberUsers.map(user => user.username);
      const notFound = memberUsernames.filter(username => !foundUsernames.includes(username));
      
      if (notFound.length > 0) {
        return res.status(404).json({ 
          success: false,
          error: `Utenti non trovati: ${notFound.join(', ')}` 
        });
      }

      const allMemberIds = [
        new ObjectId(creatorId),
        ...memberUsers.map(user => user._id)
      ];

      const newGroup = {
        name: name.trim(),
        description: description?.trim() || '',
        createdBy: new ObjectId(creatorId),
        members: allMemberIds,
        expenses: [],
        totalExpenses: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await groupsCollection.insertOne(newGroup);

      await Promise.all(
        allMemberIds.map(memberId =>
          usersCollection.updateOne(
            { _id: memberId },
            { $addToSet: { groups: result.insertedId } }
          )
        )
      );

      const allUsers = await usersCollection.find({
        _id: { $in: allMemberIds }
      }).toArray();

      const usersMap = {};
      allUsers.forEach(user => {
        usersMap[user._id.toString()] = formatUserResponse(user);
      });

      const groupResponse = {
        _id: result.insertedId,
        ...newGroup,
        createdBy: usersMap[creatorId],
        members: allMemberIds.map(id => usersMap[id.toString()] || id)
      };

      res.status(201).json({
        success: true,
        message: 'Gruppo creato con successo',
        group: groupResponse
      });
    }
  } catch (error) {
    console.error('Errore creazione gruppo:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'Un gruppo con questo nome esiste già' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni tutti i gruppi di un utente
router.get('/my-groups', authenticate, async (req, res) => {
  try {
    const userId = new ObjectId(req.userId);
    const db = await getDb();
    
    const user = await db.collection('users').findOne(
      { _id: userId },
      { projection: { groups: 1 } }
    );

    if (!user || !user.groups || user.groups.length === 0) {
      return res.json({ 
        success: true, 
        groups: [] 
      });
    }

    const groups = await db.collection('groups').find({
      _id: { $in: user.groups }
    }).sort({ updatedAt: -1 }).toArray();

    const allUserIds = new Set();
    groups.forEach(group => {
      allUserIds.add(group.createdBy.toString());
      group.members.forEach(memberId => allUserIds.add(memberId.toString()));
    });

    const users = await db.collection('users').find({
      _id: { $in: Array.from(allUserIds).map(id => new ObjectId(id)) }
    }).toArray();

    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id.toString()] = formatUserResponse(user);
    });

    const formattedGroups = groups.map(group => ({
      _id: group._id,
      name: group.name,
      description: group.description || '',
      image: group.image || null,
      createdBy: usersMap[group.createdBy.toString()] || { _id: group.createdBy },
      members: group.members.map(memberId => 
        usersMap[memberId.toString()] || { _id: memberId }
      ),
      totalExpenses: group.totalExpenses || 0,
      memberCount: group.members.length,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.json({
      success: true,
      groups: formattedGroups
    });
  } catch (error) {
    console.error('Errore recupero gruppi:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni dettagli di un gruppo specifico
router.get('/:groupId', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = new ObjectId(req.userId);
    
    const db = await getDb();
    
    const group = await db.collection('groups').findOne({
      _id: new ObjectId(groupId),
      members: userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false,
        error: 'Gruppo non trovato o accesso negato' 
      });
    }

    const allUserIds = [
      group.createdBy,
      ...group.members
    ];

    const users = await db.collection('users').find({
      _id: { $in: allUserIds }
    }).toArray();

    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id.toString()] = formatUserResponse(user);
    });

    let expenses = [];
    if (group.expenses && group.expenses.length > 0) {
      expenses = await db.collection('expenses').find({
        _id: { $in: group.expenses }
      }).sort({ createdAt: -1 }).toArray();
      
      const allExpenseUserIds = new Set();
      
      expenses.forEach(expense => {
        allExpenseUserIds.add(expense.paidBy.toString());
        
        if (expense.splitBetween && Array.isArray(expense.splitBetween)) {
          expense.splitBetween.forEach(userId => {
            allExpenseUserIds.add(userId.toString());
          });
        }
      });
      
      const expenseUsers = await db.collection('users').find({
        _id: { $in: Array.from(allExpenseUserIds).map(id => new ObjectId(id)) }
      }).toArray();
      
      const expenseUsersMap = {};
      expenseUsers.forEach(user => {
        expenseUsersMap[user._id.toString()] = formatUserResponse(user);
      });
      
      expenses = expenses.map(expense => {
        const paidByUser = expenseUsersMap[expense.paidBy.toString()] || {
          _id: expense.paidBy,
          username: 'Utente',
          name: 'Utente',
          surname: '',
          profileImage: null
        };
        
        let populatedSplitBetween = [];
        if (expense.splitBetween && Array.isArray(expense.splitBetween)) {
          populatedSplitBetween = expense.splitBetween.map(userId => {
            return expenseUsersMap[userId.toString()] || {
              _id: userId,
              username: 'Utente',
              name: 'Utente',
              surname: '',
              profileImage: null
            };
          });
        }
        
        return {
          _id: expense._id,
          description: expense.description,
          amount: expense.amount,
          paidBy: paidByUser,
          splitBetween: populatedSplitBetween,
          amountPerPerson: expense.amountPerPerson,
          paidDebts: expense.paidDebts || [],
          createdAt: expense.createdAt,
          updatedAt: expense.updatedAt || expense.createdAt
        };
      });
    }

    const formattedGroup = {
      _id: group._id,
      name: group.name,
      description: group.description || '',
      image: group.image || null,
      createdBy: usersMap[group.createdBy.toString()] || { _id: group.createdBy },
      members: group.members.map(memberId => 
        usersMap[memberId.toString()] || { _id: memberId }
      ),
      expenses: expenses,
      totalExpenses: group.totalExpenses || 0,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    console.log('Gruppo restituito con', expenses.length, 'spese');
    if (expenses.length > 0) {
      console.log('Prima spesa:', {
        desc: expenses[0].description,
        paidBy: expenses[0].paidBy?.name,
        splitBetween: expenses[0].splitBetween?.map(u => u.name).join(', '),
        paidDebts: expenses[0].paidDebts
      });
    }

    res.json({
      success: true,
      group: formattedGroup
    });
  } catch (error) {
    console.error('Errore recupero gruppo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Aggiorna il nome del gruppo
router.put('/:groupId/update', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = new ObjectId(req.userId);

    const db = await getDb();
    
    const group = await db.collection('groups').findOne({
      _id: new ObjectId(groupId),
      members: userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false,
        error: 'Gruppo non trovato o accesso negato' 
      });
    }

    if (group.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Solo il creatore può modificare il gruppo' 
      });
    }

    const updates = {};
    const updateFields = {};

    if (name && name.trim()) {
      const validation = groupHelpers.validateGroup({ name: name.trim() });
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false, 
          error: validation.error 
        });
      }
      updates.name = name.trim();
      updateFields.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || '';
      updateFields.description = description?.trim() || '';
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Nessun dato da aggiornare' 
      });
    }

    updates.updatedAt = new Date();

    const result = await db.collection('groups').updateOne(
      { _id: new ObjectId(groupId) },
      { $set: updates }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Nessuna modifica apportata' 
      });
    }

    const updatedGroup = await db.collection('groups').findOne({
      _id: new ObjectId(groupId)
    });

    const allUserIds = [
      updatedGroup.createdBy,
      ...updatedGroup.members
    ];

    const users = await db.collection('users').find({
      _id: { $in: allUserIds }
    }).toArray();

    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id.toString()] = formatUserResponse(user);
    });

    const formattedGroup = {
      _id: updatedGroup._id,
      name: updatedGroup.name,
      description: updatedGroup.description || '',
      image: updatedGroup.image || null,
      createdBy: usersMap[updatedGroup.createdBy.toString()] || { _id: updatedGroup.createdBy },
      members: updatedGroup.members.map(memberId => 
        usersMap[memberId.toString()] || { _id: memberId }
      ),
      totalExpenses: updatedGroup.totalExpenses || 0,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt
    };

    res.json({
      success: true,
      message: 'Gruppo aggiornato con successo',
      group: formattedGroup
    });

  } catch (error) {
    console.error('Errore aggiornamento gruppo:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'Un gruppo con questo nome esiste già' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Upload immagine del gruppo
router.post('/:groupId/upload-image', authenticate, upload.single('image'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = new ObjectId(req.userId);

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nessun file immagine fornito' 
      });
    }

    const db = await getDb();
    
    const group = await db.collection('groups').findOne({
      _id: new ObjectId(groupId),
      members: userId
    });

    if (!group) {
      if (req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Errore cancellazione file:', err);
        });
      }
      
      return res.status(404).json({ 
        success: false,
        error: 'Gruppo non trovato o accesso negato' 
      });
    }

    if (group.createdBy.toString() !== userId.toString()) {
      if (req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Errore cancellazione file:', err);
        });
      }
      
      return res.status(403).json({ 
        success: false,
        error: 'Solo il creatore può cambiare l\'immagine del gruppo' 
      });
    }

    const baseUrl = req.protocol + '://' + req.get('host');
    const imageUrl = `${baseUrl}/uploads/groups/${req.file.filename}`;

    const result = await db.collection('groups').updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $set: { 
          image: imageUrl,
          updatedAt: new Date() 
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Impossibile aggiornare l\'immagine del gruppo' 
      });
    }

    res.json({
      success: true,
      message: 'Immagine del gruppo aggiornata con successo',
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Errore upload immagine:', error);
    
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

// Rimuovi immagine del gruppo
router.delete('/:groupId/remove-image', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = new ObjectId(req.userId);

    const db = await getDb();
    
    const group = await db.collection('groups').findOne({
      _id: new ObjectId(groupId),
      members: userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false,
        error: 'Gruppo non trovato o accesso negato' 
      });
    }

    if (group.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Solo il creatore può rimuovere l\'immagine del gruppo' 
      });
    }

    if (group.image) {
      try {
        const imagePath = group.image.replace(/.*\/uploads\/groups\//, './uploads/groups/');
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (fileError) {
        console.error('Errore cancellazione file immagine:', fileError);
      }
    }

    const result = await db.collection('groups').updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $unset: { image: "" },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Impossibile rimuovere l\'immagine del gruppo' 
      });
    }

    res.json({
      success: true,
      message: 'Immagine rimossa con successo'
    });

  } catch (error) {
    console.error('Errore rimozione immagine:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server durante la rimozione dell\'immagine' 
    });
  }
});

// Aggiungi membri a un gruppo esistente
router.post('/:groupId/add-members', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { members } = req.body;
    const userId = new ObjectId(req.userId);

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Inserisci almeno un membro da aggiungere' 
      });
    }

    const db = await getDb();
    
    const group = await db.collection('groups').findOne({
      _id: new ObjectId(groupId),
      members: userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false,
        error: 'Gruppo non trovato o accesso negato' 
      });
    }

    const usersToAdd = await db.collection('users').find({ 
      username: { $in: members } 
    }).toArray();

    const foundUsernames = usersToAdd.map(user => user.username);
    const notFound = members.filter(username => !foundUsernames.includes(username));
    
    if (notFound.length > 0) {
      return res.status(404).json({ 
        success: false,
        error: `Utenti non trovati: ${notFound.join(', ')}` 
      });
    }

    const existingMemberIds = group.members.map(id => id.toString());
    const newMembers = usersToAdd.filter(user => 
      !existingMemberIds.includes(user._id.toString())
    );

    if (newMembers.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Tutti gli utenti selezionati sono già membri del gruppo' 
      });
    }

    const newMemberIds = newMembers.map(user => user._id);
    const allMemberIds = [...group.members, ...newMemberIds];

    await db.collection('groups').updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $addToSet: { members: { $each: newMemberIds } },
        $set: { updatedAt: new Date() }
      }
    );

    await Promise.all(
      newMemberIds.map(memberId =>
        db.collection('users').updateOne(
          { _id: memberId },
          { $addToSet: { groups: new ObjectId(groupId) } }
        )
      )
    );

    const updatedGroup = await db.collection('groups').findOne({
      _id: new ObjectId(groupId)
    });

    const allUsers = await db.collection('users').find({
      _id: { $in: allMemberIds }
    }).toArray();

    const usersMap = {};
    allUsers.forEach(user => {
      usersMap[user._id.toString()] = formatUserResponse(user);
    });

    const formattedGroup = {
      _id: updatedGroup._id,
      name: updatedGroup.name,
      description: updatedGroup.description || '',
      image: updatedGroup.image || null,
      createdBy: usersMap[updatedGroup.createdBy.toString()] || { _id: updatedGroup.createdBy },
      members: updatedGroup.members.map(memberId => 
        usersMap[memberId.toString()] || { _id: memberId }
      ),
      totalExpenses: updatedGroup.totalExpenses || 0,
      memberCount: updatedGroup.members.length,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt
    };

    res.json({
      success: true,
      message: `${newMembers.length} membro/i aggiunto/i con successo`,
      group: formattedGroup
    });

  } catch (error) {
    console.error('Errore aggiunta membri:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Rimuovi membri da un gruppo
router.post('/:groupId/remove-member', authenticate, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberId } = req.body;
    const userId = new ObjectId(req.userId);

    if (!memberId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID membro mancante' 
      });
    }

    const db = await getDb();
    
    const group = await db.collection('groups').findOne({
      _id: new ObjectId(groupId),
      members: userId
    });

    if (!group) {
      return res.status(404).json({ 
        success: false,
        error: 'Gruppo non trovato o accesso negato' 
      });
    }

    const memberToRemove = new ObjectId(memberId);
    const isMember = group.members.some(member => 
      member.toString() === memberId
    );

    if (!isMember) {
      return res.status(400).json({ 
        success: false,
        error: 'L\'utente non è membro di questo gruppo' 
      });
    }

    if (group.createdBy.toString() === memberId) {
      return res.status(400).json({ 
        success: false,
        error: 'Non puoi rimuovere il creatore del gruppo' 
      });
    }

    await db.collection('groups').updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $pull: { members: memberToRemove },
        $set: { updatedAt: new Date() }
      }
    );

    await db.collection('users').updateOne(
      { _id: memberToRemove },
      { $pull: { groups: new ObjectId(groupId) } }
    );

    const updatedGroup = await db.collection('groups').findOne({
      _id: new ObjectId(groupId)
    });

    const remainingMembers = updatedGroup.members;
    const users = await db.collection('users').find({
      _id: { $in: remainingMembers }
    }).toArray();

    const usersMap = {};
    users.forEach(user => {
      usersMap[user._id.toString()] = formatUserResponse(user);
    });

    const formattedGroup = {
      _id: updatedGroup._id,
      name: updatedGroup.name,
      description: updatedGroup.description || '',
      image: updatedGroup.image || null,
      createdBy: usersMap[updatedGroup.createdBy.toString()] || { _id: updatedGroup.createdBy },
      members: updatedGroup.members.map(memberId => 
        usersMap[memberId.toString()] || { _id: memberId }
      ),
      totalExpenses: updatedGroup.totalExpenses || 0,
      memberCount: updatedGroup.members.length,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt
    };

    res.json({
      success: true,
      message: 'Membro rimosso con successo',
      group: formattedGroup
    });

  } catch (error) {
    console.error('Errore rimozione membro:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

export default router;