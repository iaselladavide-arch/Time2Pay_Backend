// Schema per le spese
export const expenseSchema = {
  groupId: { type: 'objectId', ref: 'groups', required: true },
  description: { type: 'string', required: true },
  amount: { type: 'number', required: true, min: 0.01 },
  paidBy: { type: 'objectId', ref: 'users', required: true },
  splitBetween: [{ type: 'objectId', ref: 'users', required: true }],
  amountPerPerson: { type: 'number', required: true },
  createdAt: { type: 'date', default: Date.now },
  updatedAt: { type: 'date', default: Date.now }
};

// Schema per i pagamenti
export const paymentSchema = {
  expenseId: { type: 'objectId', ref: 'expenses', required: true },
  groupId: { type: 'objectId', ref: 'groups', required: true },
  fromUserId: { type: 'objectId', ref: 'users', required: true },
  toUserId: { type: 'objectId', ref: 'users', required: true },
  amount: { type: 'number', required: true },
  status: { type: 'string', enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: 'date', default: Date.now }
};

// Funzioni helper per le spese
export const expenseHelpers = {
  // Validazione spesa
  validateExpense(expenseData) {
    if (!expenseData.description || expenseData.description.trim().length < 3) {
      return { valid: false, error: 'La descrizione deve avere almeno 3 caratteri' };
    }
    
    if (!expenseData.amount || expenseData.amount <= 0) {
      return { valid: false, error: 'L\'importo deve essere maggiore di 0' };
    }
    
    if (!expenseData.paidBy) {
      return { valid: false, error: 'Seleziona chi ha pagato' };
    }
    
    if (!expenseData.splitBetween || expenseData.splitBetween.length === 0) {
      return { valid: false, error: 'Seleziona almeno un partecipante' };
    }
    
    return { valid: true };
  },
  
  // Calcola divisione
  calculateSplit(amount, participantsCount) {
    return parseFloat((amount / participantsCount).toFixed(2));
  },
  
  // Formatta spesa per la risposta
  formatExpenseResponse(expense, usersMap = {}) {
    return {
      _id: expense._id,
      description: expense.description,
      amount: expense.amount,
      paidBy: usersMap[expense.paidBy] || expense.paidBy,
      splitBetween: expense.splitBetween.map(userId => usersMap[userId] || userId),
      amountPerPerson: expense.amountPerPerson,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      groupId: expense.groupId
    };
  }
};