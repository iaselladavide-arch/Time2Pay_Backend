// Schema per i gruppi (solo riferimento, non è necessario per il driver nativo)
export const groupSchema = {
  name: { type: 'string', required: true },
  description: { type: 'string', required: false },
  createdBy: { type: 'objectId', ref: 'users' },
  members: [{ type: 'objectId', ref: 'users' }],
  expenses: [{ type: 'objectId', ref: 'expenses' }],
  image: { type: 'string', required: false }, // AGGIUNTO: campo per l'immagine
  totalExpenses: { type: 'number', default: 0 },
  createdAt: { type: 'date', default: Date.now },
  updatedAt: { type: 'date', default: Date.now }
};

// Funzioni helper per i gruppi
export const groupHelpers = {
  // Validazione gruppo
  validateGroup(groupData) {
    if (!groupData.name || groupData.name.trim().length < 3) {
      return { valid: false, error: 'Il nome del gruppo deve avere almeno 3 caratteri' };
    }
    return { valid: true };
  },
  
  // Formatta gruppo per la risposta
  formatGroupResponse(group, usersMap = {}) {
    return {
      _id: group._id,
      name: group.name,
      description: group.description || '',
      image: group.image || null, // AGGIUNTO: immagine del gruppo
      createdBy: usersMap[group.createdBy] || group.createdBy,
      members: group.members.map(memberId => usersMap[memberId] || memberId),
      totalExpenses: group.totalExpenses || 0,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };
  }
};