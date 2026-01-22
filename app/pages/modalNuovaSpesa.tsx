import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';

const API_URL = 'http://10.178.160.160:3000';

interface GroupMember {
  _id: string;
  username: string;
  name: string;
  surname: string;
}

interface ModalNuovaSpesaProps {
  visible: boolean;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  onClose: () => void;
  groupId: string;
  groupName: string;
  members: GroupMember[];
  userId: string;
  onExpenseCreated: () => void;
}

export default function ModalNuovaSpesa({
  visible,
  fadeAnim,
  slideAnim,
  onClose,
  groupId,
  groupName,
  members,
  userId,
  onExpenseCreated,
}: ModalNuovaSpesaProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // TROVA L'UTENTE CORRENTE TRA I MEMBRI
  const currentUser = members.find(member => member._id === userId);

  useEffect(() => {
    // Seleziona tutti i membri per default per la divisione
    if (members.length > 0) {
      const allMemberIds = members.map(member => member._id);
      setSplitBetween(allMemberIds);
    }
  }, [members]);

  const toggleMemberSelection = (memberId: string) => {
    // NON PERMETTERE DI DESELEZIONARE SE STESSI
    if (memberId === userId) {
      Alert.alert('Attenzione', 'Non puoi rimuovere te stesso dalla spesa che stai creando');
      return;
    }
    
    if (splitBetween.includes(memberId)) {
      // Rimuovi se già selezionato
      setSplitBetween(prev => prev.filter(id => id !== memberId));
    } else {
      // Aggiungi se non selezionato
      setSplitBetween(prev => [...prev, memberId]);
    }
  };

  const handleCreateExpense = async () => {
    // Validazione
    if (!description.trim()) {
      Alert.alert('Errore', 'Inserisci una descrizione per la spesa');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido (maggiore di 0)');
      return;
    }

    if (splitBetween.length === 0) {
      Alert.alert('Errore', 'Seleziona almeno un membro per dividere la spesa');
      return;
    }

    // ASSICURATI CHE L'UTENTE CORRENTE SIA SEMPRE NEI PARTECIPANTI
    const finalParticipants = splitBetween.includes(userId) 
      ? splitBetween 
      : [userId, ...splitBetween];

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          groupId,
          description: description.trim(),
          amount: parseFloat(amount),
          paidBy: userId,  // ← SEMPRE l'utente corrente è il pagatore
          splitBetween: finalParticipants,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Successo', 'Spesa creata con successo');
        // Reset form
        setDescription('');
        setAmount('');
        setSplitBetween(members.map(member => member._id));
        
        // Chiudi modal e ricarica
        onClose();
        onExpenseCreated();
      } else {
        Alert.alert('Errore', data.error || 'Impossibile creare la spesa');
      }
    } catch (error) {
      console.error('Errore creazione spesa:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setLoading(false);
    }
  };

  // Calcola l'importo a testa
  const calculatePerPerson = () => {
    if (!amount || parseFloat(amount) <= 0 || splitBetween.length === 0) {
      return 0;
    }
    
    const participantsCount = Math.max(splitBetween.length, 1);
    return parseFloat(amount) / participantsCount;
  };

  // Calcola quanto l'utente corrente riceverà
  const calculateCurrentUserBalance = () => {
    if (!amount || parseFloat(amount) <= 0 || splitBetween.length === 0) {
      return 0;
    }
    
    const totalAmount = parseFloat(amount);
    const perPerson = calculatePerPerson();
    const otherParticipants = splitBetween.filter(id => id !== userId).length;
    
    // L'utente corrente (pagatore) riceve da tutti gli altri
    return perPerson * otherParticipants;
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.modalContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.95)']}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuova Spesa</Text>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol name="xmark.circle.fill" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.groupName}>Gruppo: {groupName}</Text>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            {/* Descrizione */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Descrizione</Text>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Es. Cena al ristorante, Supermercato, etc."
                placeholderTextColor="#999"
                maxLength={100}
              />
            </View>

            {/* Importo */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Importo (€)</Text>
              <View style={styles.amountContainer}>
                <IconSymbol name="euro" size={20} color="#666" style={styles.amountIcon} />
                <TextInput
                  style={[styles.textInput, styles.amountInput]}
                  value={amount}
                  onChangeText={(text) => {
                    // Permetti solo numeri e un punto decimale
                    const cleaned = text.replace(/[^0-9.]/g, '');
                    // Assicurati che ci sia al massimo un punto decimale
                    const parts = cleaned.split('.');
                    if (parts.length > 2) return;
                    setAmount(cleaned);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* INFO PAGATORE - RIMOSSA LA SCELTA, SOLO INFO */}
            <View style={styles.inputGroup}>
              <View style={styles.payerInfoSection}>
                <Text style={styles.inputLabel}>Pagante</Text>
                <View style={styles.payerBadge}>
                  <IconSymbol name="star.fill" size={18} color="#188C65" />
                  <Text style={styles.payerText}>
                    {currentUser ? `${currentUser.name} (tu)` : 'Tu'}
                  </Text>
                </View>
              </View>
              <Text style={styles.payerHint}>
                Sarai registrato come pagante di questa spesa
              </Text>
            </View>

            {/* Dividi tra */}
            <View style={styles.inputGroup}>
              <View style={styles.splitHeader}>
                <Text style={styles.inputLabel}>Dividi tra</Text>
                <TouchableOpacity onPress={() => {
                  if (splitBetween.length === members.length) {
                    // Deseleziona tutti tranne se stessi
                    setSplitBetween([userId]);
                  } else {
                    // Seleziona tutti
                    setSplitBetween(members.map(member => member._id));
                  }
                }}>
                  <Text style={styles.selectAllText}>
                    {splitBetween.length === members.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.splitMembersGrid}>
                {members.map((member) => {
                  const isSelected = splitBetween.includes(member._id);
                  const isCurrentUser = member._id === userId;
                  
                  return (
                    <TouchableOpacity
                      key={member._id}
                      style={[
                        styles.splitMemberItem,
                        isSelected && styles.selectedSplitMember,
                        isCurrentUser && styles.currentUserItem
                      ]}
                      onPress={() => toggleMemberSelection(member._id)}
                      disabled={isCurrentUser} // Non permettere di deselezionare se stessi
                    >
                      <View style={styles.splitMemberContent}>
                        <View style={[
                          styles.splitMemberAvatar,
                          isSelected && styles.selectedSplitMemberAvatar,
                          isCurrentUser && styles.currentUserAvatar
                        ]}>
                          <Text style={[
                            styles.splitMemberAvatarText,
                            isSelected && styles.selectedSplitMemberAvatarText,
                            isCurrentUser && styles.currentUserAvatarText
                          ]}>
                            {member.name?.charAt(0)}{member.surname?.charAt(0)}
                          </Text>
                        </View>
                        <Text style={[
                          styles.splitMemberName,
                          isSelected && styles.selectedSplitMemberName,
                          isCurrentUser && styles.currentUserName
                        ]}>
                          {member.name}
                          {isCurrentUser && ' (tu)'}
                        </Text>
                        {isSelected && (
                          <View style={[
                            styles.splitMemberCheck,
                            isCurrentUser && styles.currentUserCheck
                          ]}>
                            <IconSymbol 
                              name={isCurrentUser ? "person.fill" : "checkmark"} 
                              size={isCurrentUser ? 10 : 12} 
                              color="#FFFFFF" 
                            />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              <Text style={styles.splitHint}>
                {splitBetween.length > 0 
                  ? `La spesa sarà divisa tra ${splitBetween.length} persona${splitBetween.length !== 1 ? 'e' : ''}`
                  : 'Seleziona i membri tra cui dividere la spesa'
                }
              </Text>
            </View>

            {/* Calcolo automatico */}
            {splitBetween.length > 0 && amount && parseFloat(amount) > 0 && (
              <View style={styles.calculationSection}>
                <Text style={styles.calculationTitle}>Riepilogo divisione</Text>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Importo totale:</Text>
                  <Text style={styles.calculationValue}>{parseFloat(amount).toFixed(2)} €</Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Diviso tra {splitBetween.length} persona{splitBetween.length !== 1 ? 'e' : ''}:</Text>
                  <Text style={styles.calculationValue}>
                    {calculatePerPerson().toFixed(2)} € a testa
                  </Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Saldo:</Text>
                  <Text style={[styles.calculationValue, styles.calculationBalance]}>
                    Riceverai {calculateCurrentUserBalance().toFixed(2)} €
                  </Text>
                </View>
                <Text style={styles.calculationNote}>
                  * Gli altri partecipanti dovranno rimborsarti la loro parte
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Bottoni */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.createButton]}
              onPress={handleCreateExpense}
              disabled={loading || !description.trim() || !amount || splitBetween.length === 0}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                  <Text style={styles.createButtonText}>Crea Spesa</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  groupName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  form: {
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountIcon: {
    position: 'absolute',
    left: 15,
    zIndex: 1,
  },
  amountInput: {
    paddingLeft: 40,
  },
  // SEZIONE PAGANTE (NUOVA)
  payerInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  payerText: {
    fontSize: 14,
    color: '#188C65',
    fontWeight: '600',
  },
  payerHint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
  // FINE SEZIONE PAGANTE
  
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectAllText: {
    fontSize: 14,
    color: '#188C65',
    fontWeight: '500',
  },
  splitMembersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  splitMemberItem: {
    width: '31%', // 3 per riga con spazio
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
  },
  selectedSplitMember: {
    backgroundColor: 'rgba(24,140,101,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(24,140,101,0.3)',
  },
  currentUserItem: {
    backgroundColor: 'rgba(24,140,101,0.15)',
    borderWidth: 2,
    borderColor: '#188C65',
  },
  splitMemberContent: {
    alignItems: 'center',
    position: 'relative',
  },
  splitMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectedSplitMemberAvatar: {
    backgroundColor: 'rgba(24,140,101,0.8)',
  },
  currentUserAvatar: {
    backgroundColor: '#188C65',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  splitMemberAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  selectedSplitMemberAvatarText: {
    color: '#FFFFFF',
  },
  currentUserAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  splitMemberName: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedSplitMemberName: {
    color: 'rgba(24,140,101,1)',
    fontWeight: '600',
  },
  currentUserName: {
    color: '#188C65',
    fontWeight: '700',
  },
  splitMemberCheck: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#188C65',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentUserCheck: {
    backgroundColor: '#FF9500',
  },
  splitHint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  calculationSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#666',
  },
  calculationValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  calculationBalance: {
    color: '#188C65',
    fontWeight: '600',
  },
  calculationNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  createButton: {
    backgroundColor: 'rgba(24,140,101,1)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});