import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  TextInput,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

const API_URL = 'http://10.178.160.160:3000';

interface GroupMember {
  _id: string;
  username: string;
  name: string;
  surname: string;
  profileImage?: string;
}

interface Expense {
  _id: string;
  description: string;
  amount: number;
  paidBy: GroupMember;
  splitBetween: GroupMember[];
  amountPerPerson: number;
  createdAt: string;
  updatedAt: string;
  groupId: string;
  paidDebts?: Array<{ from: string; to: string }>;
}

interface Balance {
  _id: string;
  userId: string;
  amount: number;
}

export default function SingleExpense() {
  const params = useLocalSearchParams();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<GroupMember[]>([]);
  
  const [detailedBalances, setDetailedBalances] = useState<any[]>([]);
  const [paidDebts, setPaidDebts] = useState<{ from: string; to: string }[]>([]);

  const expenseId = params.expenseId as string;
  const groupId = params.groupId as string;
  const expenseDescription = params.description as string;

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user._id);
        }
      } catch (error) {
        console.error('Errore caricamento userId:', error);
      }
    };

    loadUserId();
  }, []);

  useEffect(() => {
    if (userId && expenseId && groupId) {
      loadExpenseDetails();
    }
  }, [userId, expenseId, groupId]);

  const loadExpenseDetails = async () => {
  try {
    setLoading(true);
    
    const expenseResponse = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });

    const expenseData = await expenseResponse.json();

    if (expenseData.success && expenseData.expense) {
      console.log('Expense loaded with paidDebts:', expenseData.expense.paidDebts);
      
      setExpense(expenseData.expense);
      setPaidDebts(expenseData.expense.paidDebts || []);
      setNewDescription(expenseData.expense.description);
      setNewAmount(expenseData.expense.amount.toString());
      
      // Carica i membri del gruppo
      const groupResponse = await fetch(`${API_URL}/api/groups/${groupId}`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      
      });

      const groupData = await groupResponse.json();
      
      if (groupData.success) {
        setGroupMembers(groupData.group.members || []);
        
        const currentParticipants = expenseData.expense.splitBetween || [];
        const currentParticipantIds = currentParticipants.map((p: GroupMember) => p._id);
        
        const available = groupData.group.members.filter(
          (member: GroupMember) => !currentParticipantIds.includes(member._id)
        );
        setAvailableMembers(available);
        
        calculateDetailedBalances(expenseData.expense);
      }
    } else {
      Alert.alert('Errore', expenseData.error || 'Impossibile caricare la spesa');
      router.back();
    }
  } catch (error) {
    console.error('Errore caricamento dettagli spesa:', error);
    Alert.alert('Errore', 'Impossibile connettersi al server');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
  };

  const calculateDetailedBalances = (exp: Expense) => {
  if (!exp || !exp.splitBetween) return;
  
  const balances = exp.splitBetween.map(member => {
    const isPayer = member._id === exp.paidBy._id;
    const balance = isPayer 
      ? exp.amount - exp.amountPerPerson
      : -exp.amountPerPerson;
    
    const isDebtPaidToPayer = !isPayer && isDebtPaid(member._id, exp.paidBy._id);
    
    return {
      member,
      balance,
      isPayer,
      isDebtPaid: isDebtPaidToPayer,
      status: isPayer ? 'da ricevere' : 
              isDebtPaidToPayer ? 'pagato' : 'da pagare'
    };
  });
  
  setDetailedBalances(balances);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenseDetails();
  };

  const startEditingDescription = () => {
    setIsEditingDescription(true);
  };

  const cancelEditingDescription = () => {
    setIsEditingDescription(false);
    setNewDescription(expense?.description || '');
  };

  const saveDescription = async () => {
    if (!newDescription.trim()) {
      Alert.alert('Errore', 'La descrizione non può essere vuota');
      return;
    }

    if (newDescription.trim() === expense?.description) {
      setIsEditingDescription(false);
      return;
    }

    setIsChanging(true);
    
    try {
      const response = await fetch(`${API_URL}/api/expenses/${expenseId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ description: newDescription.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Successo', 'Descrizione aggiornata con successo');
        setExpense(prev => prev ? { ...prev, description: newDescription.trim() } : null);
        setIsEditingDescription(false);
      } else {
        Alert.alert('Errore', data.error || 'Impossibile aggiornare la descrizione');
      }
    } catch (error) {
      console.error('Errore aggiornamento descrizione:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setIsChanging(false);
    }
  };

  const startEditingAmount = () => {
    setIsEditingAmount(true);
  };

  const cancelEditingAmount = () => {
    setIsEditingAmount(false);
    setNewAmount(expense?.amount.toString() || '');
  };

  const saveAmount = async () => {
    const amountValue = parseFloat(newAmount);
    
    if (!newAmount || isNaN(amountValue) || amountValue <= 0) {
      Alert.alert('Errore', 'Inserisci un importo valido (maggiore di 0)');
      return;
    }

    if (amountValue === expense?.amount) {
      setIsEditingAmount(false);
      return;
    }

    Alert.alert(
      'Modifica importo',
      `Vuoi cambiare l'importo da ${expense?.amount.toFixed(2)} € a ${amountValue.toFixed(2)} €?\n\nLa divisione verrà ricalcolata automaticamente.`,
      [
        {
          text: 'Annulla',
          style: 'cancel',
          onPress: cancelEditingAmount
        },
        {
          text: 'Conferma',
          onPress: async () => {
            setIsChanging(true);
            
            try {
              const response = await fetch(`${API_URL}/api/expenses/${expenseId}/update`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': userId,
                },
                body: JSON.stringify({ amount: amountValue }),
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Successo', 'Importo aggiornato con successo');
                setExpense(prev => prev ? { 
                  ...prev, 
                  amount: amountValue,
                  amountPerPerson: data.expense.amountPerPerson 
                } : null);
                setIsEditingAmount(false);
                if (expense) {
                  calculateDetailedBalances({ ...expense, amount: amountValue, amountPerPerson: data.expense.amountPerPerson });
                }
              } else {
                Alert.alert('Errore', data.error || 'Impossibile aggiornare l\'importo');
              }
            } catch (error) {
              console.error('Errore aggiornamento importo:', error);
              Alert.alert('Errore', 'Impossibile connettersi al server');
            } finally {
              setIsChanging(false);
            }
          }
        }
      ]
    );
  };

  const changePaidBy = (member: GroupMember) => {
    if (member._id === expense?.paidBy._id) return;

    Alert.alert(
      'Cambia pagatore',
      `Vuoi cambiare il pagatore da ${expense?.paidBy.name} a ${member.name}?`,
      [
        {
          text: 'Annulla',
          style: 'cancel'
        },
        {
          text: 'Conferma',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/expenses/${expenseId}/update`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': userId,
                },
                body: JSON.stringify({ paidBy: member._id }),
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Successo', 'Pagatore aggiornato con successo');
                setExpense(prev => prev ? { 
                  ...prev, 
                  paidBy: member,
                  amountPerPerson: data.expense.amountPerPerson 
                } : null);
                if (expense) {
                  calculateDetailedBalances({ ...expense, paidBy: member, amountPerPerson: data.expense.amountPerPerson });
                }
              } else {
                Alert.alert('Errore', data.error || 'Impossibile aggiornare il pagatore');
              }
            } catch (error) {
              console.error('Errore aggiornamento pagatore:', error);
              Alert.alert('Errore', 'Impossibile connettersi al server');
            }
          }
        }
      ]
    );
  };

  const addParticipant = (member: GroupMember) => {
    Alert.alert(
      'Aggiungi partecipante',
      `Vuoi aggiungere ${member.name} alla spesa?`,
      [
        {
          text: 'Annulla',
          style: 'cancel'
        },
        {
          text: 'Aggiungi',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/expenses/${expenseId}/add-participant`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': userId,
                },
                body: JSON.stringify({ participantId: member._id }),
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Successo', 'Partecipante aggiunto con successo');
                setExpense(prev => prev ? { 
                  ...prev, 
                  splitBetween: data.expense.splitBetween,
                  amountPerPerson: data.expense.amountPerPerson 
                } : null);
                setAvailableMembers(prev => prev.filter(m => m._id !== member._id));
                if (expense) {
                  calculateDetailedBalances({ 
                    ...expense, 
                    splitBetween: data.expense.splitBetween,
                    amountPerPerson: data.expense.amountPerPerson 
                  });
                }
              } else {
                Alert.alert('Errore', data.error || 'Impossibile aggiungere il partecipante');
              }
            } catch (error) {
              console.error('Errore aggiunta partecipante:', error);
              Alert.alert('Errore', 'Impossibile connettersi al server');
            }
          }
        }
      ]
    );
  };

  const removeParticipant = (member: GroupMember) => {
    if (expense?.splitBetween.length === 1) {
      Alert.alert('Errore', 'La spesa deve avere almeno un partecipante');
      return;
    }

    if (member._id === expense?.paidBy._id) {
      Alert.alert('Errore', 'Non puoi rimuovere il pagatore dalla spesa');
      return;
    }

    Alert.alert(
      'Rimuovi partecipante',
      `Vuoi rimuovere ${member.name} dalla spesa?`,
      [
        {
          text: 'Annulla',
          style: 'cancel'
        },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/expenses/${expenseId}/remove-participant`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': userId,
                },
                body: JSON.stringify({ participantId: member._id }),
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Successo', 'Partecipante rimosso con successo');
                setExpense(prev => prev ? { 
                  ...prev, 
                  splitBetween: data.expense.splitBetween,
                  amountPerPerson: data.expense.amountPerPerson 
                } : null);
                setAvailableMembers(prev => [...prev, member]);
                if (expense) {
                  calculateDetailedBalances({ 
                    ...expense, 
                    splitBetween: data.expense.splitBetween,
                    amountPerPerson: data.expense.amountPerPerson 
                  });
                }
              } else {
                Alert.alert('Errore', data.error || 'Impossibile rimuovere il partecipante');
              }
            } catch (error) {
              console.error('Errore rimozione partecipante:', error);
              Alert.alert('Errore', 'Impossibile connettersi al server');
            }
          }
        }
      ]
    );
  };

  const deleteExpense = () => {
    Alert.alert(
      'Elimina spesa',
      'Sei sicuro di voler eliminare questa spesa? Questa azione non può essere annullata.',
      [
        {
          text: 'Annulla',
          style: 'cancel'
        },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_URL}/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                  'x-user-id': userId,
                },
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Successo', 'Spesa eliminata con successo');
                router.back();
              } else {
                Alert.alert('Errore', data.error || 'Impossibile eliminare la spesa');
              }
            } catch (error) {
              console.error('Errore eliminazione spesa:', error);
              Alert.alert('Errore', 'Impossibile connettersi al server');
            }
          }
        }
      ]
    );
  };

  const markAsPaid = async (fromMemberId: string, toMemberId: string) => {
  try {
    const isCurrentlyPaid = isDebtPaid(fromMemberId, toMemberId);
    const endpoint = isCurrentlyPaid ? 'unmark-paid' : 'mark-paid';
    
    console.log(`CHIAMO: ${endpoint}`, {
      expenseId,
      fromUserId: fromMemberId,
      toUserId: toMemberId,
      userId
    });

    const response = await fetch(`${API_URL}/api/expenses/${expenseId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ 
        fromUserId: fromMemberId, 
        toUserId: toMemberId 
      }),
    });

    const data = await response.json();
    console.log('RISPOSTA API:', data);

    if (data.success) {
      // RICARICA SEMPRE I DATI
      await loadExpenseDetails();
      Alert.alert('Successo', data.message);
    } else {
      Alert.alert('Errore', data.error);
    }
    
  } catch (error) {
    console.error('Errore:', error);
    Alert.alert('Errore', 'Impossibile connettersi al server');
  }
  };

  const isDebtPaid = (from: string, to: string) => {
  // Controlla sia nello stato locale che nell'expense
  const localPaid = paidDebts.some((d: any) => d.from === from && d.to === to);
  const expensePaid = expense?.paidDebts?.some((d: any) => d.from === from && d.to === to) || false;
  
  return localPaid || expensePaid;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string, surname: string) => {
    return `${name?.charAt(0) || ''}${surname?.charAt(0) || ''}`.toUpperCase();
  };

  const getAvatarContent = (member: GroupMember) => {
    if (member.profileImage) {
      return (
        <Image 
          source={{ uri: member.profileImage }} 
          style={styles.participantAvatarImage}
        />
      );
    } else {
      return (
        <View style={styles.participantAvatar}>
          <Text style={styles.participantAvatarText}>
            {getInitials(member.name, member.surname)}
          </Text>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: expenseDescription || 'Spesa', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#188C65" />
          <Text style={styles.loadingText}>Caricamento spesa...</Text>
        </View>
      </>
    );
  }

  if (!expense) {
    return (
      <View style={styles.errorContainer}>
        <IconSymbol name="exclamationmark.triangle" size={50} color="#FF9500" />
        <Text style={styles.errorText}>Spesa non trovata</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: expense.description || 'Spesa',
        headerShown: true,
        headerBackTitle: 'Gruppo',
      }} />

      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#188C65']}
            tintColor="#188C65"
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.expenseAvatar}>
            <IconSymbol name="clock" size={50} color="#188C65" />
          </View>
          
          {isEditingDescription ? (
            <View style={styles.editDescriptionContainer}>
              <View style={styles.inputContainer}>
                <IconSymbol name="pencil" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.descriptionInput}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Descrizione spesa"
                  autoFocus={true}
                  maxLength={100}
                />
              </View>
              <View style={styles.editButtons}>
                <TouchableOpacity 
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={cancelEditingDescription}
                  disabled={isChanging}
                >
                  <IconSymbol name="xmark" size={16} color="#666" />
                  <Text style={styles.cancelButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.editButton, styles.saveButton]}
                  onPress={saveDescription}
                  disabled={isChanging || !newDescription.trim()}
                >
                  {isChanging ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Salva</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.descriptionContainer}
              onPress={startEditingDescription}
              activeOpacity={0.7}
            >
              <Text style={styles.expenseDescription}>{expense.description}</Text>
              <View style={styles.editIconContainer}>
                <IconSymbol name="pencil" size={18} color="#666" />
              </View>
            </TouchableOpacity>
          )}
          
          <View style={styles.amountSection}>
            {isEditingAmount ? (
              <View style={styles.editAmountContainer}>
                <View style={styles.amountInputContainer}>
                  <IconSymbol name="euro" size={24} color="#666" style={styles.amountIcon} />
                  <TextInput
                    style={styles.amountInput}
                    value={newAmount}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      if (parts.length > 2) return;
                      setNewAmount(cleaned);
                    }}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    autoFocus={true}
                  />
                </View>
                <View style={styles.editButtons}>
                  <TouchableOpacity 
                    style={[styles.editButton, styles.cancelButton]}
                    onPress={cancelEditingAmount}
                    disabled={isChanging}
                  >
                    <IconSymbol name="xmark" size={16} color="#666" />
                    <Text style={styles.cancelButtonText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.editButton, styles.saveButton]}
                    onPress={saveAmount}
                    disabled={isChanging || !newAmount}
                  >
                    {isChanging ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>Salva</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.amountContainer}
                onPress={startEditingAmount}
                activeOpacity={0.7}
              >
                <Text style={styles.expenseAmount}>{expense.amount.toFixed(2)} €</Text>
                <View style={styles.editIconContainer}>
                  <IconSymbol name="pencil" size={18} color="#666" />
                </View>
              </TouchableOpacity>
            )}
            
            <Text style={styles.amountPerPerson}>
              {expense.amountPerPerson.toFixed(2)} € a testa
            </Text>
          </View>
          
          <View style={styles.dateInfo}>
            <IconSymbol name="calendar" size={16} color="#666" />
            <Text style={styles.dateText}>
              Creato il {formatDate(expense.createdAt)}
            </Text>
          </View>
          
          
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pagato da</Text>
          <View style={styles.paidBySection}>
            <TouchableOpacity 
              style={styles.paidByCard}
              disabled={expense.splitBetween.length <= 1}
              activeOpacity={expense.splitBetween.length > 1 ? 0.7 : 1}
            >
              <View style={styles.paidByHeader}>
                {/* Avatar del pagatore con immagine profilo */}
                {expense.paidBy.profileImage ? (
                  <Image 
                    source={{ uri: expense.paidBy.profileImage }} 
                    style={styles.paidByAvatarImage}
                  />
                ) : (
                  <View style={styles.paidByAvatar}>
                    <Text style={styles.paidByAvatarText}>
                      {getInitials(expense.paidBy.name, expense.paidBy.surname)}
                    </Text>
                  </View>
                )}
                <View style={styles.paidByInfo}>
                  <Text style={styles.paidByName}>
                    {expense.paidBy.name} {expense.paidBy.surname}
                  </Text>
                  <Text style={styles.paidByUsername}>@{expense.paidBy.username}</Text>
                </View>
              </View>
              <View style={styles.paidByBalance}>
                <Text style={styles.paidByBalanceText}>
                  Riceverà {(expense.amount - expense.amountPerPerson).toFixed(2)} €
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Partecipanti ({expense.splitBetween.length})
            </Text>
            {availableMembers.length > 0 && (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowAddParticipants(true)}
              >
                <IconSymbol name="plus" size={20} color="#188C65" />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.participantsList}>
            {expense.splitBetween.map((participant) => (
              <View key={participant._id} style={styles.participantItem}>
                <View style={styles.participantLeft}>
                  {/* Avatar partecipante con immagine profilo */}
                  {getAvatarContent(participant)}
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {participant.name} {participant.surname}
                    </Text>
                    <Text style={styles.participantUsername}>@{participant.username}</Text>
                  </View>
                </View>
                
                <View style={styles.participantRight}>
                  {participant._id === expense.paidBy._id ? (
                    <View style={styles.payerBadge}>
                      <IconSymbol name="checkmark.circle.fill" size={14} color="#188C65" />
                      <Text style={styles.payerText}>Pagato</Text>
                    </View>
                  ) : (
                    (() => {
                      const isDebtPaidToPayer = isDebtPaid(participant._id, expense.paidBy._id);
                      
                      return isDebtPaidToPayer ? (
                        <View style={styles.paidDebtBadge}>
                          <IconSymbol name="checkmark.circle.fill" size={14} color="#188C65" />
                          <Text style={styles.paidDebtText}>Pagato</Text>
                        </View>
                      ) : (
                        <View style={styles.debtBadge}>
                          <IconSymbol name="exclamationmark.circle" size={14} color="#FF9500" />
                          <Text style={styles.debtText}>
                            Deve {expense.amountPerPerson.toFixed(2)} €
                          </Text>
                        </View>
                      );
                    })()
                  )}
                  
                  {participant._id !== expense.paidBy._id && expense.splitBetween.length > 1 && (
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => removeParticipant(participant)}
                    >
                      <IconSymbol name="xmark.circle" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riepilogo Bilanci</Text>
          
          <View style={styles.balancesList}>
            {detailedBalances.map((balance, index) => (
              <View key={index} style={styles.balanceItem}>
                <View style={styles.balanceLeft}>
                  {/* Avatar con immagine profilo per bilancio */}
                  {balance.member.profileImage ? (
                    <Image 
                      source={{ uri: balance.member.profileImage }} 
                      style={[
                        styles.balanceAvatarImage,
                        balance.isPayer && styles.payerAvatarImage,
                        !balance.isPayer && balance.balance < 0 && isDebtPaid(balance.member._id, expense.paidBy._id) && styles.paidDebtAvatarImage
                      ]}
                    />
                  ) : (
                    <View style={[
                      styles.balanceAvatar,
                      balance.isPayer && styles.payerAvatar,
                      !balance.isPayer && balance.balance < 0 && isDebtPaid(balance.member._id, expense.paidBy._id) && styles.paidDebtAvatar
                    ]}>
                      <Text style={[
                        styles.balanceAvatarText,
                        balance.isPayer && styles.payerAvatarText,
                        !balance.isPayer && balance.balance < 0 && isDebtPaid(balance.member._id, expense.paidBy._id) && styles.paidDebtAvatarText
                      ]}>
                        {getInitials(balance.member.name, balance.member.surname)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.balanceInfo}>
                    <Text style={styles.balanceName}>
                      {balance.member.name} {balance.member.surname}
                    </Text>
                    <Text style={[
                      styles.balanceStatus,
                      !balance.isPayer && balance.balance < 0 && isDebtPaid(balance.member._id, expense.paidBy._id) && styles.paidDebtStatus
                    ]}>
                      {balance.status === 'in pari' ? 'In pari' : 
                      balance.status === 'da ricevere' ? 'Da ricevere' : 
                      isDebtPaid(balance.member._id, expense.paidBy._id) ? 'Pagato' : 'Da pagare'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.balanceRight}>
                  <Text style={[
                    styles.balanceAmount,
                    balance.balance > 0 ? styles.positiveBalance : 
                    balance.balance < 0 ? styles.negativeBalance : styles.zeroBalance,
                    !balance.isPayer && balance.balance < 0 && isDebtPaid(balance.member._id, expense.paidBy._id) && styles.paidDebtAmount
                  ]}>
                    {balance.balance > 0 ? '+' : ''}{balance.balance.toFixed(2)} €
                  </Text>
                  
                  {!balance.isPayer && balance.balance < 0 && (
                    isDebtPaid(balance.member._id, expense.paidBy._id) ? (
                      <TouchableOpacity 
                        style={styles.paidBadge}
                      >
                        <IconSymbol name="checkmark.circle.fill" size={18} color="#188C65" />
                        <Text style={styles.paidText}>Pagato</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.markPaidButton}
                        onPress={() => markAsPaid(balance.member._id, expense.paidBy._id)}
                      >
                        <IconSymbol name="checkmark.circle" size={18} color="#188C65" />
                        <Text style={styles.paidText}>Segna pagato</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            ))}
          </View>
          
          <Text style={styles.balancesHint}>
            I debiti possono essere segnati come pagati usando l'icona del checkmark
          </Text>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={deleteExpense}
          >
            <IconSymbol name="trash" size={20} color="#FFFFFF" />
            <Text style={styles.deleteButtonText}>Elimina Spesa</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showAddParticipants}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddParticipants(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aggiungi Partecipanti</Text>
              <TouchableOpacity onPress={() => setShowAddParticipants(false)}>
                <IconSymbol name="xmark.circle.fill" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            
            {availableMembers.length === 0 ? (
              <View style={styles.emptyAvailable}>
                <IconSymbol name="person.2" size={40} color="#CCCCCC" />
                <Text style={styles.emptyAvailableText}>
                  Tutti i membri del gruppo sono già partecipanti
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableMembers}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.availableMemberItem}
                    onPress={() => addParticipant(item)}
                  >
                    <View style={styles.availableMemberLeft}>
                      {/* Avatar membri disponibili con immagine profilo */}
                      {item.profileImage ? (
                        <Image 
                          source={{ uri: item.profileImage }} 
                          style={styles.availableMemberAvatarImage}
                        />
                      ) : (
                        <View style={styles.availableMemberAvatar}>
                          <Text style={styles.availableMemberAvatarText}>
                            {getInitials(item.name, item.surname)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.availableMemberInfo}>
                        <Text style={styles.availableMemberName}>
                          {item.name} {item.surname}
                        </Text>
                        <Text style={styles.availableMemberUsername}>@{item.username}</Text>
                      </View>
                    </View>
                    <IconSymbol name="plus.circle" size={24} color="#188C65" />
                  </TouchableOpacity>
                )}
                style={styles.availableMembersList}
              />
            )}
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowAddParticipants(false)}
            >
              <Text style={styles.modalCloseButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 25,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  expenseAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  expenseDescription: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginRight: 8,
  },
  editIconContainer: {
    padding: 4,
  },
  editDescriptionContainer: {
    width: '100%',
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  descriptionInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    padding: 0,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  expenseAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#188C65',
    marginRight: 8,
  },
  amountPerPerson: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  editAmountContainer: {
    width: '100%',
    alignItems: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
    width: '60%',
  },
  amountIcon: {
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: '#188C65',
    padding: 0,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 5,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
    minWidth: 90,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: 'rgba(24,140,101,1)',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 15,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    padding: 4,
  },
  paidBySection: {
    marginTop: 10,
  },
  paidByCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  paidByHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  paidByAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paidByAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  paidByInfo: {
    flex: 1,
  },
  paidByName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  paidByUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  paidByBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  paidByBalanceText: {
    fontSize: 14,
    color: '#188C65',
    fontWeight: '500',
    marginLeft: 6,
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
  participantUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  payerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  payerText: {
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },
  debtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  debtText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  balancesList: {
    marginTop: 10,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  balanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  payerAvatar: {
    backgroundColor: 'rgba(24,140,101,1)',
  },
  balanceAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  payerAvatarText: {
    color: '#FFFFFF',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  balanceStatus: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  positiveBalance: {
    color: '#188C65',
  },
  negativeBalance: {
    color: '#FF9500',
  },
  zeroBalance: {
    color: '#666',
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  paidText: {
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },
  balancesHint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 15,
    textAlign: 'center',
  },
  actionsSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '80%',
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
  emptyAvailable: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyAvailableText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
  },
  availableMembersList: {
    maxHeight: 400,
  },
  availableMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  availableMemberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availableMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  availableMemberAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  availableMemberInfo: {
    flex: 1,
  },
  availableMemberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  availableMemberUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalCloseButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  paidDebtBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(24,140,101,0.1)',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  gap: 4,
  },
  paidDebtText: {
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },
  paidDebtAvatar: {
  backgroundColor: 'rgba(24,140,101,0.2)',
  borderWidth: 1,
  borderColor: '#188C65',
  },
  paidDebtAvatarText: {
    color: '#188C65',
    fontWeight: 'bold',
  },
  paidDebtStatus: {
    color: '#188C65',
    fontStyle: 'italic',
  },
  paidDebtAmount: {
    color: '#188C65',
    fontStyle: 'italic',
    textDecorationLine: 'line-through',
  },
   // Per il pagatore
  paidByAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  // Per i partecipanti
  participantAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  // Per i bilanci
  balanceAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  // Per il pagatore nel riepilogo bilanci
  payerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#188C65',
  },

  // Per i membri disponibili nel modal
  availableMemberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },

  // Per debiti pagati
  paidDebtAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#188C65',
  },
});