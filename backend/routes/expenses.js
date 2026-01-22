import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';

const router = express.Router();

// Helper function per formattare la risposta utente con gestione utenti eliminati
const safeFormatUserResponse = async (userId, db) => {
  if (!userId) {
    return {
      _id: null,
      username: 'Utente non trovato',
      name: 'Utente non trovato',
      surname: '',
      email: '',
      profileImage: null,
      isDeleted: true
    };
  }

  try {
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0, groups: 0 } }
    );

    if (!user) {
      return {
        _id: userId,
        username: 'Utente non trovato',
        name: 'Utente non trovato',
        surname: '',
        email: '',
        profileImage: null,
        isDeleted: true
      };
    }

    return {
      _id: user._id.toString(),
      username: user.username || 'Utente',
      name: user.name || user.username || 'Utente',
      surname: user.surname || '',
      email: user.email || '',
      profileImage: user.profileImage || null,
      isDeleted: false
    };
  } catch (error) {
    console.error('Errore recupero utente per safeFormat:', error);
    return {
      _id: userId,
      username: 'Utente non trovato',
      name: 'Utente non trovato',
      surname: '',
      email: '',
      profileImage: null,
      isDeleted: true
    };
  }
};

// Helper function per formattare la risposta utente (compatibilità)
const formatUserResponse = (user) => {
  if (!user) {
    return {
      _id: null,
      username: 'Utente non trovato',
      name: 'Utente non trovato',
      surname: '',
      email: '',
      profileImage: null,
      isDeleted: true
    };
  }
  
  return {
    _id: user._id,
    username: user.username || 'Utente',
    name: user.name || user.username || 'Utente',
    surname: user.surname || '',
    email: user.email || '',
    profileImage: user.profileImage || null,
    isDeleted: false
  };
};

// Middleware di autenticazione
const authenticate = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    console.log('HEADERS:', req.headers);
    console.log('userId ricevuto:', userId);

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Autenticazione richiesta' 
      });
    }

    // Controllo validità ObjectId
    if (!ObjectId.isValid(userId)) {
      console.log('userId non valido:', userId);
      return res.status(400).json({ 
        success: false, 
        error: 'userId non valido' 
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


// Crea nuova spesa
router.post('/', authenticate, async (req, res) => {
  try {
    const { groupId, description, amount, paidBy, splitBetween } = req.body;
    const userId = new ObjectId(req.userId);

    if (!groupId || !description || !amount || !paidBy || !splitBetween || !Array.isArray(splitBetween)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Dati mancanti o non validi' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'L\'importo deve essere maggiore di 0' 
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

    const isPaidByMember = group.members.some(member => 
      member.toString() === paidBy
    );

    if (!isPaidByMember) {
      return res.status(400).json({ 
        success: false,
        error: 'Il pagatore non è membro del gruppo' 
      });
    }

    const invalidMembers = splitBetween.filter(memberId => 
      !group.members.some(member => member.toString() === memberId)
    );

    if (invalidMembers.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Alcuni membri selezionati non sono nel gruppo' 
      });
    }

    const amountPerPerson = amount / splitBetween.length;

    const newExpense = {
      groupId: new ObjectId(groupId),
      description: description.trim(),
      amount: parseFloat(amount),
      paidBy: new ObjectId(paidBy),
      splitBetween: splitBetween.map(id => new ObjectId(id)),
      amountPerPerson: parseFloat(amountPerPerson.toFixed(2)),
      paidDebts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('expenses').insertOne(newExpense);

    await db.collection('groups').updateOne(
      { _id: new ObjectId(groupId) },
      { 
        $push: { expenses: result.insertedId },
        $inc: { totalExpenses: parseFloat(amount) },
        $set: { updatedAt: new Date() }
      }
    );

    const insertedExpense = await db.collection('expenses').findOne({
      _id: result.insertedId
    });

    // MODIFICA: Usa safeFormatUserResponse invece di db.collection('users').findOne
    const paidByUser = await safeFormatUserResponse(paidBy, db);

    const formattedExpense = {
      _id: insertedExpense._id,
      description: insertedExpense.description,
      amount: insertedExpense.amount,
      paidBy: paidByUser,
      splitBetween: await Promise.all(splitBetween.map(async id => 
        await safeFormatUserResponse(id, db)
      )),
      amountPerPerson: insertedExpense.amountPerPerson,
      paidDebts: insertedExpense.paidDebts || [],
      createdAt: insertedExpense.createdAt,
      updatedAt: insertedExpense.updatedAt,
      groupId: groupId
    };

    res.status(201).json({
      success: true,
      message: 'Spesa creata con successo',
      expense: formattedExpense
    });

  } catch (error) {
    console.error('Errore creazione spesa:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni dettagli di una spesa specifica
router.get('/:expenseId', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = new ObjectId(req.userId);

    const db = await getDb();
    
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    if (!expense) {
      return res.status(404).json({ 
        success: false,
        error: 'Spesa non trovata' 
      });
    }

    const group = await db.collection('groups').findOne({
      _id: expense.groupId,
      members: userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false,
        error: 'Accesso negato alla spesa' 
      });
    }

    // MODIFICA: Usa safeFormatUserResponse
    const paidByUser = await safeFormatUserResponse(expense.paidBy, db);

    // MODIFICA: Usa safeFormatUserResponse per i partecipanti
    const splitBetweenUsers = await Promise.all(
      expense.splitBetween.map(async (id) => 
        await safeFormatUserResponse(id, db)
      )
    );

    const formattedExpense = {
      _id: expense._id,
      description: expense.description,
      amount: expense.amount,
      paidBy: paidByUser,
      splitBetween: splitBetweenUsers,
      amountPerPerson: expense.amountPerPerson,
      paidDebts: expense.paidDebts || [],
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      groupId: expense.groupId.toString()
    };

    res.json({
      success: true,
      expense: formattedExpense
    });

  } catch (error) {
    console.error('Errore recupero spesa:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni spese di un gruppo
router.get('/group/:groupId', authenticate, async (req, res) => {
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

    const expenses = await db.collection('expenses')
      .find({ groupId: new ObjectId(groupId) })
      .sort({ createdAt: -1 })
      .toArray();

    // MODIFICA: Usa safeFormatUserResponse per ogni spesa
    const formattedExpenses = await Promise.all(
      expenses.map(async (expense) => {
        const paidByUser = await safeFormatUserResponse(expense.paidBy, db);
        
        return {
          _id: expense._id,
          description: expense.description,
          amount: expense.amount,
          paidBy: paidByUser,
          splitBetween: expense.splitBetween,
          amountPerPerson: expense.amountPerPerson,
          paidDebts: expense.paidDebts || [],
          createdAt: expense.createdAt,
          updatedAt: expense.updatedAt
        };
      })
    );

    res.json({
      success: true,
      expenses: formattedExpenses
    });

  } catch (error) {
    console.error('Errore recupero spese:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Aggiorna una spesa
router.put('/:expenseId/update', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { description, amount, paidBy } = req.body;
    const userId = new ObjectId(req.userId);

    const db = await getDb();
    
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    if (!expense) {
      return res.status(404).json({ 
        success: false,
        error: 'Spesa non trovata' 
      });
    }

    const group = await db.collection('groups').findOne({
      _id: expense.groupId,
      members: userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false,
        error: 'Accesso negato alla spesa' 
      });
    }

    const updates = {};
    
    if (description && description.trim()) {
      updates.description = description.trim();
    }
    
    if (amount && amount > 0) {
      updates.amount = parseFloat(amount);
      updates.amountPerPerson = parseFloat((amount / expense.splitBetween.length).toFixed(2));
    }
    
    if (paidBy) {
      const isParticipant = expense.splitBetween.some(id => 
        id.toString() === paidBy
      );
      
      if (!isParticipant) {
        return res.status(400).json({ 
          success: false,
          error: 'Il pagatore deve essere un partecipante della spesa' 
        });
      }
      
      updates.paidBy = new ObjectId(paidBy);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Nessun dato da aggiornare' 
      });
    }

    updates.updatedAt = new Date();

    await db.collection('expenses').updateOne(
      { _id: new ObjectId(expenseId) },
      { $set: updates }
    );

    if (updates.amount) {
      const difference = updates.amount - expense.amount;
      await db.collection('groups').updateOne(
        { _id: expense.groupId },
        { $inc: { totalExpenses: difference } }
      );
    }

    const updatedExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    // MODIFICA: Usa safeFormatUserResponse
    const paidByUser = await safeFormatUserResponse(updatedExpense.paidBy, db);

    // MODIFICA: Usa safeFormatUserResponse per i partecipanti
    const splitBetweenUsers = await Promise.all(
      updatedExpense.splitBetween.map(async (id) => 
        await safeFormatUserResponse(id, db)
      )
    );

    const formattedExpense = {
      _id: updatedExpense._id,
      description: updatedExpense.description,
      amount: updatedExpense.amount,
      paidBy: paidByUser,
      splitBetween: splitBetweenUsers,
      amountPerPerson: updatedExpense.amountPerPerson,
      paidDebts: updatedExpense.paidDebts || [],
      createdAt: updatedExpense.createdAt,
      updatedAt: updatedExpense.updatedAt
    };

    res.json({
      success: true,
      message: 'Spesa aggiornata con successo',
      expense: formattedExpense
    });

  } catch (error) {
    console.error('Errore aggiornamento spesa:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// In expenses.js - Endpoint per saldare un debito
router.post('/:expenseId/settle-debt', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { fromUserId, toUserId } = req.body;

    const db = await getDb();
    
    const result = await db.collection('expenses').updateOne(
      { _id: new ObjectId(expenseId) },
      { 
        $addToSet: { paidDebts: { from: fromUserId, to: toUserId } }
      }
    );
    
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });
    
    if (expense) {
      await db.collection('groups').updateOne(
        { _id: expense.groupId },
        { 
          $inc: { 
            [`balances.${fromUserId}.${toUserId}`]: -expense.amountPerPerson,
            [`balances.${toUserId}.total`]: -expense.amountPerPerson
          }
        }
      );
    }
    
    res.json({
      success: true,
      message: 'Debito saldato e bilanci aggiornati'
    });
    
  } catch (error) {
    console.error('Errore saldatura debito:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Aggiungi partecipante a una spesa
router.post('/:expenseId/add-participant', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { participantId } = req.body;
    const userId = new ObjectId(req.userId);

    if (!participantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID partecipante mancante' 
      });
    }

    const db = await getDb();
    
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    if (!expense) {
      return res.status(404).json({ 
        success: false,
        error: 'Spesa non trovata' 
      });
    }

    const group = await db.collection('groups').findOne({
      _id: expense.groupId,
      members: userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false,
        error: 'Accesso negato alla spesa' 
      });
    }

    const isGroupMember = group.members.some(member => 
      member.toString() === participantId
    );

    if (!isGroupMember) {
      return res.status(400).json({ 
        success: false,
        error: 'Il partecipante non è membro del gruppo' 
      });
    }

    const isAlreadyParticipant = expense.splitBetween.some(id => 
      id.toString() === participantId
    );

    if (isAlreadyParticipant) {
      return res.status(400).json({ 
        success: false,
        error: 'Il partecipante è già nella spesa' 
      });
    }

    const newSplitBetween = [...expense.splitBetween, new ObjectId(participantId)];
    const newAmountPerPerson = expense.amount / newSplitBetween.length;

    await db.collection('expenses').updateOne(
      { _id: new ObjectId(expenseId) },
      { 
        $set: { 
          splitBetween: newSplitBetween,
          amountPerPerson: parseFloat(newAmountPerPerson.toFixed(2)),
          updatedAt: new Date()
        }
      }
    );

    const updatedExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    // MODIFICA: Usa safeFormatUserResponse
    const paidByUser = await safeFormatUserResponse(expense.paidBy, db);

    // MODIFICA: Usa safeFormatUserResponse per i partecipanti
    const splitBetweenUsers = await Promise.all(
      updatedExpense.splitBetween.map(async (id) => 
        await safeFormatUserResponse(id, db)
      )
    );

    const formattedExpense = {
      _id: updatedExpense._id,
      description: updatedExpense.description,
      amount: updatedExpense.amount,
      paidBy: paidByUser,
      splitBetween: splitBetweenUsers,
      amountPerPerson: updatedExpense.amountPerPerson,
      paidDebts: updatedExpense.paidDebts || [],
      createdAt: updatedExpense.createdAt,
      updatedAt: updatedExpense.updatedAt
    };

    res.json({
      success: true,
      message: 'Partecipante aggiunto con successo',
      expense: formattedExpense
    });

  } catch (error) {
    console.error('Errore aggiunta partecipante:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Rimuovi partecipante da una spesa
router.post('/:expenseId/remove-participant', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { participantId } = req.body;
    const userId = new ObjectId(req.userId);

    if (!participantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID partecipante mancante' 
      });
    }

    const db = await getDb();
    
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    if (!expense) {
      return res.status(404).json({ 
        success: false,
        error: 'Spesa non trovata' 
      });
    }

    const group = await db.collection('groups').findOne({
      _id: expense.groupId,
      members: userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false,
        error: 'Accesso negato alla spesa' 
      });
    }

    const isParticipant = expense.splitBetween.some(id => 
      id.toString() === participantId
    );

    if (!isParticipant) {
      return res.status(400).json({ 
        success: false,
        error: 'Il partecipante non è nella spesa' 
      });
    }

    if (expense.splitBetween.length === 1) {
      return res.status(400).json({ 
        success: false,
        error: 'La spesa deve avere almeno un partecipante' 
      });
    }

    if (expense.paidBy.toString() === participantId) {
      return res.status(400).json({ 
        success: false,
        error: 'Non puoi rimuovere il pagatore dalla spesa' 
      });
    }

    const newSplitBetween = expense.splitBetween.filter(id => 
      id.toString() !== participantId
    );
    const newAmountPerPerson = expense.amount / newSplitBetween.length;

    await db.collection('expenses').updateOne(
      { _id: new ObjectId(expenseId) },
      { 
        $set: { 
          splitBetween: newSplitBetween,
          amountPerPerson: parseFloat(newAmountPerPerson.toFixed(2)),
          updatedAt: new Date()
        }
      }
    );

    const updatedExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    // MODIFICA: Usa safeFormatUserResponse
    const paidByUser = await safeFormatUserResponse(expense.paidBy, db);

    // MODIFICA: Usa safeFormatUserResponse per i partecipanti
    const splitBetweenUsers = await Promise.all(
      updatedExpense.splitBetween.map(async (id) => 
        await safeFormatUserResponse(id, db)
      )
    );

    const formattedExpense = {
      _id: updatedExpense._id,
      description: updatedExpense.description,
      amount: updatedExpense.amount,
      paidBy: paidByUser,
      splitBetween: splitBetweenUsers,
      amountPerPerson: updatedExpense.amountPerPerson,
      createdAt: updatedExpense.createdAt,
      updatedAt: updatedExpense.updatedAt
    };

    res.json({
      success: true,
      message: 'Partecipante rimosso con successo',
      expense: formattedExpense
    });

  } catch (error) {
    console.error('Errore rimozione partecipante:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Ottieni spese di un utente
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = await getDb();

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'ID utente non valido' });
    }

    const expenses = await db.collection('expenses')
      .find({ splitBetween: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();

    const formattedExpenses = await Promise.all(expenses.map(async (expense) => {
      const paidByUser = await safeFormatUserResponse(expense.paidBy, db);
      const splitBetweenUsers = await Promise.all(
        expense.splitBetween.map(id => safeFormatUserResponse(id, db))
      );

      return {
        _id: expense._id,
        description: expense.description,
        amount: expense.amount,
        paidBy: paidByUser,
        splitBetween: splitBetweenUsers,
        amountPerPerson: expense.amountPerPerson,
        paidDebts: expense.paidDebts || [],
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
        groupId: expense.groupId
      };
    }));

    res.json({ success: true, expenses: formattedExpenses });
  } catch (error) {
    console.error('Errore recupero spese utente:', error);
    res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});

// SEGNA DEBITO COME PAGATO
router.post('/:expenseId/mark-paid', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { fromUserId, toUserId } = req.body;
    console.log('MARK-PAID chiamato:', { expenseId, fromUserId, toUserId, userId: req.userId });

    if (!expenseId || !fromUserId || !toUserId) {
      return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    if (!ObjectId.isValid(expenseId) || !ObjectId.isValid(fromUserId) || !ObjectId.isValid(toUserId)) {
      return res.status(400).json({ success: false, error: 'ID non validi' });
    }

    const db = await getDb();

    const expense = await db.collection('expenses').findOne({ _id: new ObjectId(expenseId) });
    if (!expense) return res.status(404).json({ success: false, error: 'Spesa non trovata' });

    console.log('Spesa trovata:', expense);

    const paidDebt = { from: fromUserId, to: toUserId };
    const result = await db.collection('expenses').updateOne(
      { _id: new ObjectId(expenseId) },
      { $push: { paidDebts: paidDebt }, $set: { updatedAt: new Date() } }
    );

    console.log('Update risultato:', result);

    const updatedExpense = await db.collection('expenses').findOne({ _id: new ObjectId(expenseId) });
    console.log('Spesa aggiornata:', updatedExpense);

    res.json({ success: true, message: 'Debito segnato come pagato', expense: updatedExpense });
  } catch (err) {
    console.error('Errore mark-paid:', err);
    res.status(500).json({ success: false, error: 'Errore interno del server' });
  }
});


// Elimina una spesa
router.delete('/:expenseId', authenticate, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const userId = new ObjectId(req.userId);

    const db = await getDb();
    
    const expense = await db.collection('expenses').findOne({
      _id: new ObjectId(expenseId)
    });

    if (!expense) {
      return res.status(404).json({ 
        success: false,
        error: 'Spesa non trovata' 
      });
    }

    const group = await db.collection('groups').findOne({
      _id: expense.groupId,
      members: userId
    });

    if (!group) {
      return res.status(403).json({ 
        success: false,
        error: 'Accesso negato alla spesa' 
      });
    }

    await db.collection('expenses').deleteOne({
      _id: new ObjectId(expenseId)
    });

    await db.collection('groups').updateOne(
      { _id: expense.groupId },
      { 
        $pull: { expenses: new ObjectId(expenseId) },
        $inc: { totalExpenses: -expense.amount },
        $set: { updatedAt: new Date() }
      }
    );

    await db.collection('payments').deleteMany({
      expenseId: new ObjectId(expenseId)
    });

    res.json({
      success: true,
      message: 'Spesa eliminata con successo'
    });

  } catch (error) {
    console.error('Errore eliminazione spesa:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

// Aggiungi endpoint per pulire le spese orfane (opzionale)
router.post('/cleanup-orphaned-expenses', async (req, res) => {
  try {
    const db = await getDb();
    
    // Trova tutte le spese
    const expenses = await db.collection('expenses').find({}).toArray();
    
    let cleanedCount = 0;
    
    for (const expense of expenses) {
      try {
        // Controlla se l'utente che ha pagato esiste ancora
        const paidByUser = await db.collection('users').findOne(
          { _id: new ObjectId(expense.paidBy) }
        );
        
        // Se l'utente non esiste più, elimina la spesa
        if (!paidByUser) {
          await db.collection('expenses').deleteOne({ _id: expense._id });
          cleanedCount++;
          console.log(`Eliminata spesa orfana: ${expense._id}`);
          continue;
        }
        
        // Controlla il gruppo
        const group = await db.collection('groups').findOne(
          { _id: expense.groupId }
        );
        
        // Se il gruppo non esiste più, elimina la spesa
        if (!group) {
          await db.collection('expenses').deleteOne({ _id: expense._id });
          cleanedCount++;
          console.log(`Eliminata spesa con gruppo eliminato: ${expense._id}`);
        }
      } catch (error) {
        console.error(`Errore processing expense ${expense._id}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Pulite ${cleanedCount} spese orfane`,
      cleanedCount
    });
    
  } catch (error) {
    console.error('Errore cleanup spese:', error);
    res.status(500).json({ 
      success: false,
      error: 'Errore interno del server' 
    });
  }
});

export default router;