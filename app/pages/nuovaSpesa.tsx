import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

const DateTimePicker = require('@react-native-community/datetimepicker').default;

const API_URL = 'http://10.178.160.160:3000';

type DateTimePickerEvent = {
  type: string;
  nativeEvent: {
    timestamp: number;
  };
};

interface GroupMember {
  _id: string;
  username: string;
  name: string;
  surname: string;
}

export default function NuovaSpesa() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  const groupId = params.groupId as string;
  const groupName = params.groupName as string;

  useEffect(() => {
    const loadUserAndMembers = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user._id);
          setUserName(user.name || user.username);
          
          // L'utente corrente è automaticamente selezionato come partecipante
          setSelectedParticipants([user._id]);
          
          // Carica i membri del gruppo
          await loadGroupMembers(user._id);
        }
      } catch (error) {
        console.error('Errore caricamento dati:', error);
        Alert.alert('Errore', 'Impossibile caricare i dati');
      }
    };

    loadUserAndMembers();
  }, []);

  const loadGroupMembers = async (currentUserId: string) => {
    try {
      setLoadingMembers(true);
      
      const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
        method: 'GET',
        headers: {
          'x-user-id': currentUserId,
        },
      });

      const data = await response.json();

      if (data.success) {
        setGroupMembers(data.group.members || []);
      } else {
        Alert.alert('Errore', data.error || 'Impossibile caricare i membri del gruppo');
      }
    } catch (error) {
      console.error('Errore caricamento membri:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!description.trim()) {
      Alert.alert('Errore', 'Inserisci una descrizione per la spesa');
      return;
    }

    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido');
      return;
    }

    if (!userId) {
      Alert.alert('Errore', 'Devi effettuare il login');
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert('Errore', 'Seleziona almeno un partecipante');
      return;
    }

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
          amount: amountNum,
          paidBy: userId,  // SEMPRE l'utente corrente è il pagatore
          splitBetween: selectedParticipants,  // Partecipanti selezionati
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Successo!', 'Spesa creata con successo', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
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

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(memberId)) {
        // Non permettere di deselezionare se stessi
        if (memberId === userId) {
          Alert.alert('Attenzione', 'Non puoi rimuovere te stesso dalla spesa che stai creando');
          return prev;
        }
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const toggleAllParticipants = () => {
    if (selectedParticipants.length === groupMembers.length) {
      // Deseleziona tutti tranne se stessi
      setSelectedParticipants([userId]);
    } else {
      // Seleziona tutti
      setSelectedParticipants(groupMembers.map(member => member._id));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getMemberName = (memberId: string) => {
    const member = groupMembers.find(m => m._id === memberId);
    if (member) {
      return `${member.name || member.username} ${member.surname || ''}`.trim();
    }
    return memberId === userId ? userName : 'Utente';
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nuova Spesa',
          headerShown: true,
          headerBackTitle: 'Indietro',
        }}
      />

      <ScrollView style={styles.container}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descrizione *</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Es. Cena al ristorante"
              placeholderTextColor="#999"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Importo (€) *</Text>
            <View style={styles.amountContainer}>
              <IconSymbol name="eurosign" size={20} color="#666" style={styles.amountIcon} />
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9.,]/g, '');
                  setAmount(cleaned);
                }}
                placeholder="0,00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <IconSymbol name="calendar" size={20} color="#666" style={styles.dateIcon} />
              <Text style={styles.dateText}>{formatDate(date)}</Text>
              <IconSymbol name="chevron.right" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              locale="it-IT"
              maximumDate={new Date()}
            />
          )}

          <View style={styles.inputGroup}>
            <View style={styles.participantsHeader}>
              <Text style={styles.label}>Divisa tra ({selectedParticipants.length} persone)</Text>
              {groupMembers.length > 1 && (
                <TouchableOpacity onPress={toggleAllParticipants} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>
                    {selectedParticipants.length === groupMembers.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.splitInfo}>
              La spesa sarà divisa equamente tra tutti i partecipanti selezionati. 
              Tu sei automaticamente il pagatore.
            </Text>
            
            <View style={styles.payerInfo}>
              <View style={styles.payerBadge}>
                <IconSymbol name="checkmark.circle.fill" size={16} color="#188C65" />
                <Text style={styles.payerText}>Pagante: {userName}</Text>
              </View>
            </View>
          </View>

          {loadingMembers ? (
            <View style={styles.loadingMembers}>
              <ActivityIndicator size="small" color="#188C65" />
              <Text style={styles.loadingText}>Caricamento membri...</Text>
            </View>
          ) : (
            <View style={styles.participantsList}>
              {groupMembers.map((member) => {
                const isSelected = selectedParticipants.includes(member._id);
                const isCurrentUser = member._id === userId;
                const memberName = `${member.name || member.username} ${member.surname || ''}`.trim();
                
                return (
                  <TouchableOpacity
                    key={member._id}
                    style={[
                      styles.participantItem,
                      isSelected && styles.participantItemSelected,
                      isCurrentUser && styles.currentUserItem
                    ]}
                    onPress={() => toggleParticipant(member._id)}
                    disabled={isCurrentUser} // Non permettere di deselezionare se stessi
                  >
                    <View style={styles.participantLeft}>
                      <View style={[
                        styles.participantAvatar,
                        isCurrentUser && styles.currentUserAvatar
                      ]}>
                        <Text style={styles.participantAvatarText}>
                          {member.name?.charAt(0) || member.username.charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.participantInfo}>
                        <Text style={styles.participantName}>
                          {memberName}
                          {isCurrentUser && <Text style={styles.youIndicator}> (tu)</Text>}
                        </Text>
                        <Text style={styles.participantUsername}>@{member.username}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.participantRight}>
                      {isCurrentUser ? (
                        <View style={styles.payerBadgeSmall}>
                          <IconSymbol name="checkmark.circle" size={16} color="#188C65" />
                          <Text style={styles.payerTextSmall}>Pagante</Text>
                        </View>
                      ) : (
                        <>
                          {isSelected ? (
                            <View style={styles.selectedBadge}>
                              <IconSymbol name="checkmark.circle.fill" size={20} color="#188C65" />
                            </View>
                          ) : (
                            <View style={styles.unselectedBadge}>
                              <IconSymbol name="circle" size={20} color="#CCCCCC" />
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.infoBox}>
            <IconSymbol name="info.circle" size={18} color="#666" />
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Importante:</Text> Sarai registrato come pagante di questa spesa. 
              Gli altri partecipanti riceveranno una notifica e dovranno rimborsarti la loro parte.
            </Text>
          </View>

          <View style={styles.calculationBox}>
            <Text style={styles.calculationTitle}>Calcolo automatico:</Text>
            {amount && selectedParticipants.length > 0 && !isNaN(parseFloat(amount.replace(',', '.'))) ? (
              <>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Importo totale:</Text>
                  <Text style={styles.calculationValue}>{parseFloat(amount.replace(',', '.')).toFixed(2)} €</Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Numero partecipanti:</Text>
                  <Text style={styles.calculationValue}>{selectedParticipants.length}</Text>
                </View>
                <View style={[styles.calculationRow, styles.calculationTotal]}>
                  <Text style={styles.calculationTotalLabel}>A testa:</Text>
                  <Text style={styles.calculationTotalValue}>
                    {(parseFloat(amount.replace(',', '.')) / selectedParticipants.length).toFixed(2)} €
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.calculationHint}>
                Inserisci l'importo e seleziona i partecipanti per vedere il calcolo
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, (!description || !amount || selectedParticipants.length === 0) && styles.createButtonDisabled]}
          onPress={handleCreateExpense}
          disabled={!description || !amount || selectedParticipants.length === 0 || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol name="checkmark.circle" size={22} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Crea Spesa</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  amountIcon: {
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dateIcon: {
    marginRight: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllButton: {
    padding: 8,
  },
  selectAllText: {
    fontSize: 14,
    color: '#188C65',
    fontWeight: '500',
  },
  splitInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  payerInfo: {
    marginBottom: 15,
  },
  payerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    alignSelf: 'flex-start',
  },
  payerText: {
    fontSize: 14,
    color: '#188C65',
    fontWeight: '500',
  },
  loadingMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  participantsList: {
    marginTop: 10,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  participantItemSelected: {
    backgroundColor: 'rgba(24,140,101,0.05)',
    borderRadius: 8,
    marginBottom: 4,
  },
  currentUserItem: {
    backgroundColor: 'rgba(24,140,101,0.08)',
    borderRadius: 8,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentUserAvatar: {
    backgroundColor: 'rgba(24,140,101,0.2)',
    borderWidth: 1,
    borderColor: '#188C65',
  },
  participantAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  youIndicator: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  participantUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  payerBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  payerTextSmall: {
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },
  selectedBadge: {
    padding: 4,
  },
  unselectedBadge: {
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.05)',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(24,140,101,0.1)',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#188C65',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
  },
  calculationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    alignItems: 'center',
    paddingVertical: 6,
  },
  calculationLabel: {
    fontSize: 14,
    color: '#666',
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  calculationTotal: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  calculationTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  calculationTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#188C65',
  },
  calculationHint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(24,140,101,0.5)',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});