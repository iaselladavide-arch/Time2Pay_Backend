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
  TextInput,
  Dimensions,
  Image,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

const API_URL = 'http://10.178.160.160:3000';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GroupMember {
  _id: string;
  username: string;
  name: string;
  surname: string;
  profileImage?: string; // Aggiungi questo campo

}

interface Expense {
  _id: string;
  description: string;
  amount: number;
  paidBy: GroupMember;
  createdAt: string;
  amountPerPerson: number;
  paidDebts?: Array<{ from: string; to: string }>;
  splitBetween?: (GroupMember | string)[];
}

// Cache per memorizzare i nomi degli utenti
const userCache = new Map<string, GroupMember>();

// Funzione debounce semplice
const useDebouncedCallback = (callback: Function, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };
};

// Funzioni helper per gestire partecipanti
const getParticipantId = (participant: GroupMember | string): string => {
  return typeof participant === 'string' ? participant : participant._id;
};

const getParticipantName = (participant: GroupMember | string, groupMembers: GroupMember[]): string => {
  const participantId = getParticipantId(participant);
  
  // Cerca prima nella cache
  const cachedUser = userCache.get(participantId);
  if (cachedUser) {
    return cachedUser.name || cachedUser.username || 'Utente';
  }
  
  // Cerca nei membri del gruppo
  const groupMember = groupMembers.find(member => member._id === participantId);
  if (groupMember) {
    userCache.set(participantId, groupMember);
    return groupMember.name || groupMember.username || 'Utente';
  }
  
  // Fallback temporaneo
  return `User_${participantId.substring(participantId.length - 4)}`;
};

const getParticipantFullName = (participant: GroupMember | string, groupMembers: GroupMember[]): string => {
  const participantId = getParticipantId(participant);
  
  // Cerca prima nella cache
  const cachedUser = userCache.get(participantId);
  if (cachedUser) {
    if (cachedUser.name && cachedUser.surname) {
      return `${cachedUser.name} ${cachedUser.surname}`;
    }
    return cachedUser.name || cachedUser.username || 'Utente';
  }
  
  // Cerca nei membri del gruppo
  const groupMember = groupMembers.find(member => member._id === participantId);
  if (groupMember) {
    userCache.set(participantId, groupMember);
    if (groupMember.name && groupMember.surname) {
      return `${groupMember.name} ${groupMember.surname}`;
    }
    return groupMember.name || groupMember.username || 'Utente';
  }
  
  return `User_${participantId.substring(participantId.length - 4)}`;
};

// Funzione per ottenere un oggetto utente completo
// Funzione per ottenere un oggetto utente completo
const getParticipantObject = (participant: GroupMember | string, groupMembers: GroupMember[]): GroupMember => {
  const participantId = getParticipantId(participant);
  
  // Se è già un oggetto completo, restituiscilo
  if (typeof participant !== 'string') {
    userCache.set(participantId, participant);
    return participant;
  }
  
  // Cerca nella cache
  const cachedUser = userCache.get(participantId);
  if (cachedUser) {
    return cachedUser;
  }
  
  // Cerca nei membri del gruppo
  const groupMember = groupMembers.find(member => member._id === participantId);
  if (groupMember) {
    userCache.set(participantId, groupMember);
    return groupMember;
  }
  
  // Fallback
  return {
    _id: participantId,
    username: `user_${participantId.substring(participantId.length - 6)}`,
    name: `User_${participantId.substring(participantId.length - 4)}`,
    surname: '',
    profileImage: '', // Aggiungi questo
  };
};

export default function AllExpenses() {
  const params = useLocalSearchParams();
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  const groupId = params.groupId as string;
  const groupName = params.groupName as string;

  // Crea una funzione debounced per la ricerca
  const debouncedSearch = useDebouncedCallback((query: string) => {
    if (query.trim() === '') {
      applyFilter(activeFilter);
    } else {
      performSearch(query);
    }
  }, 300);

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user._id);
          
          // Salva l'utente corrente nella cache
          const currentUser: GroupMember = {
            _id: user._id,
            username: user.username || '',
            name: user.name || 'Tu',
            surname: user.surname || '',
          };
          userCache.set(user._id, currentUser);
        }
      } catch (error) {
        console.error('Errore caricamento userId:', error);
      }
    };

    loadUserId();
  }, []);

  useEffect(() => {
    if (userId && groupId) {
      loadGroupMembers();
    }
  }, [userId, groupId]);

  useEffect(() => {
    if (groupMembers.length > 0) {
      loadAllExpenses();
    }
  }, [groupMembers]);

  // Effetto per gestire la ricerca quando cambia la query
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery]);

const loadGroupMembers = async () => {
  try {
    console.log('Caricamento dettagli del gruppo...');
    const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });

    const data = await response.json();
    console.log('Risposta dettagli gruppo:', data);
    
    if (data.success && data.group && data.group.members) {
      // Assicurati che ogni membro abbia profileImage
      const normalizedMembers = data.group.members.map((member: any) => ({
        _id: member._id?.toString() || member._id,
        username: member.username || '',
        name: member.name || '',
        surname: member.surname || '',
        profileImage: member.profileImage || null, // Assicurati che questo campo esista
      }));
      
      setGroupMembers(normalizedMembers);
      
      // Salva i membri in cache
      normalizedMembers.forEach((member: GroupMember) => {
        if (member._id) {
          userCache.set(member._id, member);
        }
      });
      
      console.log('Membri salvati in cache:', normalizedMembers.length);
      
      // Controlla se i membri hanno profileImage
      normalizedMembers.forEach((member: GroupMember, index: number) => {
        console.log(`Membro ${index}:`, {
          name: member.name,
          profileImage: member.profileImage ? 'Sì' : 'No'
        });
      });
    } else {
      console.error('Errore nel formato della risposta gruppo:', data);
    }
  } catch (error) {
    console.error('Errore caricamento dettagli gruppo:', error);
  }
};

// Funzione di fallback se l'endpoint /members non esiste ancora
const loadGroupMembersFallback = async () => {
  try {
    const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });

    const data = await response.json();
    if (data.success && data.group && data.group.members) {
      const normalizedMembers = data.group.members.map((member: any) => ({
        _id: member._id?.toString() || member._id,
        username: member.username || '',
        name: member.name || '',
        surname: member.surname || '',
      }));
      
      setGroupMembers(normalizedMembers);
      
      // Salva i membri in cache
      normalizedMembers.forEach((member: GroupMember) => {
        if (member._id) {
          userCache.set(member._id, member);
        }
      });
      
      console.log('Membri caricati tramite fallback:', normalizedMembers);
    }
  } catch (error) {
    console.error('Errore caricamento membri fallback:', error);
  }
};

  // Normalizza un expense: converte stringhe ID in oggetti utente usando i membri del gruppo
  const normalizeExpense = (expense: any): Expense => {
    const normalizedExpense = { ...expense };
    
    // Normalizza paidBy se è una stringa
    if (typeof normalizedExpense.paidBy === 'string') {
      const paidById = normalizedExpense.paidBy;
      const paidByUser = groupMembers.find(member => member._id === paidById);
      if (paidByUser) {
        normalizedExpense.paidBy = paidByUser;
        userCache.set(paidById, paidByUser);
      } else {
        normalizedExpense.paidBy = {
          _id: paidById,
          username: `user_${paidById.substring(paidById.length - 6)}`,
          name: `User_${paidById.substring(paidById.length - 4)}`,
          surname: '',
        };
      }
    }
    
    // Normalizza splitBetween se esiste
    if (normalizedExpense.splitBetween && Array.isArray(normalizedExpense.splitBetween)) {
      normalizedExpense.splitBetween = normalizedExpense.splitBetween.map((item: any) => {
        // Se è una stringa (ID)
        if (typeof item === 'string') {
          // Cerca nei membri del gruppo
          const groupMember = groupMembers.find(member => member._id === item);
          if (groupMember) {
            userCache.set(item, groupMember);
            return groupMember;
          }
          
          // Fallback
          return {
            _id: item,
            username: `user_${item.substring(item.length - 6)}`,
            name: `Utente non trovato`,
            surname: '',
          };
        }
        
        // Se è già un oggetto
        if (item._id) {
          // Salva in cache
          userCache.set(item._id, item);
          return item;
        }
        
        return item;
      });
    }
    
    return normalizedExpense;
  };

  const loadAllExpenses = async () => {
    try {
      setLoading(true);
      
      console.log('Caricamento spese del gruppo...');
      const response = await fetch(`${API_URL}/api/expenses/group/${groupId}`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await response.json();
      console.log('Risposta spese:', data.expenses?.length || 0, 'spese trovate');

      if (data.success) {
        // Normalizza tutti gli expense usando i membri del gruppo
        const normalizedExpenses = data.expenses.map((expense: any) => normalizeExpense(expense));
        
        // Salva TUTTE le spese normalizzate
        setAllExpenses(normalizedExpenses);
        // Mostra tutte le spese inizialmente
        setFilteredExpenses(normalizedExpenses);
        
        console.log('Spese normalizzate:', normalizedExpenses.length);
        
        // Resetta il filtro attivo
        setActiveFilter('all');
        // Resetta la ricerca
        setSearchQuery('');
        setIsSearching(false);
      } else {
        Alert.alert('Errore', data.error || 'Impossibile caricare le spese');
        router.back();
      }
    } catch (error) {
      console.error('Errore caricamento spese:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Pulisci la cache e ricarica tutto
    userCache.clear();
    loadGroupMembers();
  };

  // Funzione per verificare se una spesa è completamente pagata
  const isExpenseFullyPaid = (expense: Expense): boolean => {
    if (!expense.paidDebts || !expense.splitBetween) return false;
    
    // Filtra i partecipanti che non sono il pagatore
    const debtors = expense.splitBetween.filter(participant => {
      const participantId = getParticipantId(participant);
      return participantId !== expense.paidBy._id;
    });
    
    const paidDebtsCount = expense.paidDebts.filter(debt => 
      debt.to === expense.paidBy._id
    ).length;
    
    return paidDebtsCount === debtors.length;
  };

  // Funzione per applicare i filtri
  const applyFilter = (filterType: string) => {
    setActiveFilter(filterType);
    setIsSearching(false);
    
    let filtered = allExpenses;
    
    switch (filterType) {
      case 'unpaid':
        filtered = allExpenses.filter(expense => {
          const debtors = expense.splitBetween?.filter(participant => {
            const participantId = getParticipantId(participant);
            return participantId !== expense.paidBy._id;
          }) || [];
          
          const paidDebtsCount = expense.paidDebts?.filter(debt => 
            debt.to === expense.paidBy._id
          ).length || 0;
          
          return paidDebtsCount < debtors.length;
        });
        break;
        
      case 'paid':
        filtered = allExpenses.filter(expense => isExpenseFullyPaid(expense));
        break;
        
      case 'mine':
        filtered = allExpenses.filter(expense => 
          expense.paidBy._id === userId
        );
        break;
        
      case 'owed':
        filtered = allExpenses.filter(expense => {
          if (expense.paidBy._id === userId) return false;
          
          const isParticipant = expense.splitBetween?.some(participant => {
            const participantId = getParticipantId(participant);
            return participantId === userId;
          });
          if (!isParticipant) return false;
          
          const hasPaid = expense.paidDebts?.some(debt => 
            debt.from === userId && debt.to === expense.paidBy._id
          );
          
          return !hasPaid;
        });
        break;

      case 'alreadyPaid':
        filtered = allExpenses.filter(expense => {
          if (expense.paidBy._id === userId) return false;
          
          const isParticipant = expense.splitBetween?.some(participant => {
            const participantId = getParticipantId(participant);
            return participantId === userId;
          });
          if (!isParticipant) return false;
          
          const hasPaid = expense.paidDebts?.some(debt => 
            debt.from === userId && debt.to === expense.paidBy._id
          );
          
          return hasPaid;
        });
        break;
        
      case 'all':
      default:
        break;
    }
    
    if (searchQuery.trim() !== '') {
      filtered = filterBySearch(filtered, searchQuery);
    }
    
    setFilteredExpenses(filtered);
  };

  // Funzione per filtrare per ricerca
  const filterBySearch = (expenses: Expense[], query: string): Expense[] => {
    if (!query.trim()) return expenses;
    
    const searchTerm = query.toLowerCase().trim();
    
    return expenses.filter(expense => {
      if (expense.description?.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      if (expense.paidBy?.name?.toLowerCase().includes(searchTerm) ||
          expense.paidBy?.surname?.toLowerCase().includes(searchTerm) ||
          expense.paidBy?.username?.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      if (expense.amount.toString().includes(searchTerm)) {
        return true;
      }
      
      if (expense.splitBetween?.some(participant => {
        const name = getParticipantName(participant, groupMembers).toLowerCase();
        const fullName = getParticipantFullName(participant, groupMembers).toLowerCase();
        return name.includes(searchTerm) || fullName.includes(searchTerm);
      })) {
        return true;
      }
      
      return false;
    });
  };

  // Funzione per eseguire la ricerca
  const performSearch = (query: string) => {
    setIsSearching(query.trim() !== '');
    
    let filtered = allExpenses;
    
    if (activeFilter !== 'all') {
      switch (activeFilter) {
        case 'unpaid':
          filtered = allExpenses.filter(expense => {
            const debtors = expense.splitBetween?.filter(participant => {
              const participantId = getParticipantId(participant);
              return participantId !== expense.paidBy._id;
            }) || [];
            
            const paidDebtsCount = expense.paidDebts?.filter(debt => 
              debt.to === expense.paidBy._id
            ).length || 0;
            
            return paidDebtsCount < debtors.length;
          });
          break;
          
        case 'paid':
          filtered = allExpenses.filter(expense => isExpenseFullyPaid(expense));
          break;
          
        case 'mine':
          filtered = allExpenses.filter(expense => 
            expense.paidBy._id === userId
          );
          break;
          
        case 'owed':
          filtered = allExpenses.filter(expense => {
            const isParticipant = expense.splitBetween?.some(participant => {
              const participantId = getParticipantId(participant);
              return participantId === userId;
            });
            const isPayer = expense.paidBy._id === userId;
            
            if (!isParticipant || isPayer) return false;
            
            const hasPaid = expense.paidDebts?.some(debt => 
              debt.from === userId && debt.to === expense.paidBy._id
            );
            
            return !hasPaid;
          });
          break;
          
        case 'alreadyPaid':
          filtered = allExpenses.filter(expense => {
            const isParticipant = expense.splitBetween?.some(participant => {
              const participantId = getParticipantId(participant);
              return participantId === userId;
            });
            const isPayer = expense.paidBy._id === userId;
            
            if (!isParticipant || isPayer) return false;
            
            const hasPaid = expense.paidDebts?.some(debt => 
              debt.from === userId && debt.to === expense.paidBy._id
            );
            
            return hasPaid;
          });
          break;
      }
    }
    
    if (query.trim() !== '') {
      filtered = filterBySearch(filtered, query);
    }
    
    setFilteredExpenses(filtered);
  };

  // Calcola i contatori per ogni filtro
  const filterCounts = {
    all: allExpenses.length,
    unpaid: allExpenses.filter(exp => {
      const debtors = exp.splitBetween?.filter(participant => {
        const participantId = getParticipantId(participant);
        return participantId !== exp.paidBy._id;
      }) || [];
      const paidCount = exp.paidDebts?.filter(d => d.to === exp.paidBy._id).length || 0;
      return paidCount < debtors.length;
    }).length,
    paid: allExpenses.filter(exp => isExpenseFullyPaid(exp)).length,
    mine: allExpenses.filter(exp => exp.paidBy._id === userId).length,
    owed: allExpenses.filter(exp => {
      const isParticipant = exp.splitBetween?.some(participant => {
        const participantId = getParticipantId(participant);
        return participantId === userId;
      });
      const isPayer = exp.paidBy._id === userId;
      if (!isParticipant || isPayer) return false;
      const hasPaid = exp.paidDebts?.some(d => d.from === userId && d.to === exp.paidBy._id);
      return !hasPaid;
    }).length,
    alreadyPaid: allExpenses.filter(exp => {
      const isParticipant = exp.splitBetween?.some(participant => {
        const participantId = getParticipantId(participant);
        return participantId === userId;
      });
      const isPayer = exp.paidBy._id === userId;
      if (!isParticipant || isPayer) return false;
      const hasPaid = exp.paidDebts?.some(d => d.from === userId && d.to === exp.paidBy._id);
      return hasPaid;
    }).length,
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatRelativeDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Oggi';
      if (diffDays === 1) return 'Ieri';
      if (diffDays < 7) return `${diffDays} giorni fa`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
      
      return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Funzione per verificare se un debito specifico è stato pagato
  const isDebtPaid = (expense: Expense, fromUserId: string, toUserId: string): boolean => {
    return expense.paidDebts?.some(debt => 
      debt.from === fromUserId && debt.to === toUserId
    ) || false;
  };

  // Calcola il totale delle spese FILTRATE
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Pulisci la ricerca
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    applyFilter(activeFilter);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ 
          title: 'Tutte le Spese',
          headerShown: true,
          headerBackTitle: 'Gruppo',
        }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#188C65" />
          <Text style={styles.loadingText}>Caricamento spese...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: `Spese di ${groupName}`,
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
        contentContainerStyle={styles.scrollContent}
      >
        {/* Riepilogo */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <IconSymbol name="doc" size={24} color="#666" />
              <Text style={styles.summaryNumber}>{filteredExpenses.length}</Text>
              <Text style={styles.summaryLabel}>
                {isSearching ? 'Trovate' : 'Spese'}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <IconSymbol name="euro" size={30} color="#666" />
              <Text style={styles.summaryNumber}>{totalAmount.toFixed(2)}</Text>
              <Text style={styles.summaryLabel}>Totale</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <IconSymbol name="checkmark.circle" size={24} color="#666" />
              <Text style={styles.summaryNumber}>
                {filteredExpenses.filter(exp => isExpenseFullyPaid(exp)).length}
              </Text>
              <Text style={styles.summaryLabel}>Saldate</Text>
            </View>
          </View>
        </View>

        {/* Filtri */}
        <View style={styles.filtersSection}>
          <Text style={styles.filtersTitle}>Filtra spese:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.filtersList}
            contentContainerStyle={styles.filtersContent}
          >
            {[
              { key: 'all', label: 'Tutte', icon: null },
              { key: 'unpaid', label: 'Non Saldate', icon: 'clock' },
              { key: 'paid', label: 'Saldate', icon: 'checkmark.circle' },
              { key: 'mine', label: 'Mie', icon: 'star.fill' },
              { key: 'owed', label: 'Da Saldare', icon: 'exclamationmark.circle' },
            ].map((filter) => (
              <TouchableOpacity 
                key={filter.key}
                style={[
                  styles.filterButton,
                  activeFilter === filter.key && styles.filterActive
                ]}
                onPress={() => applyFilter(filter.key)}
              >
                {filter.icon && (
                  <IconSymbol 
                    name={filter.icon} 
                    size={16} 
                    color={activeFilter === filter.key ? '#FFFFFF' : 
                           filter.key === 'paid' || filter.key === 'alreadyPaid' ? '#188C65' :
                           filter.key === 'mine' ? '#FF9500' :
                           filter.key === 'owed' ? '#FF3B30' : '#666'} 
                  />
                )}
                <Text style={[
                  styles.filterButtonText,
                  activeFilter === filter.key && styles.filterActiveText,
                  filter.key === 'all' && !activeFilter && styles.filterAllText
                ]}>
                  {filter.label} ({filterCounts[filter.key as keyof typeof filterCounts] || 0})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Barra di Ricerca */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca spese..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <IconSymbol name="xmark.circle.fill" size={20} color="#999" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          {isSearching && (
            <View style={styles.searchInfo}>
              <Text style={styles.searchInfoText}>
                Ricerca: "{searchQuery}" • {filteredExpenses.length} risultato{filteredExpenses.length !== 1 ? 'i' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Lista delle spese */}
        <View style={styles.expensesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} numberOfLines={2}>
              {isSearching ? 'Risultati ricerca' :
               activeFilter === 'all' ? 'Tutte le Spese' :
               activeFilter === 'unpaid' ? 'Spese da Pagare' :
               activeFilter === 'paid' ? 'Spese Saldate' :
               activeFilter === 'mine' ? 'Spese Pagate da Me' :
               activeFilter === 'owed' ? 'Spese che Devo' :
               activeFilter === 'alreadyPaid' ? 'Spese Già Pagate' :
               'Spese'}
              {' '}({filteredExpenses.length})
            </Text>
            <TouchableOpacity onPress={() => {
              Alert.alert(
                'Ordina per',
                undefined,
                [
                  {
                    text: 'Data (più recenti)',
                    onPress: () => {
                      const sorted = [...filteredExpenses].sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      );
                      setFilteredExpenses(sorted);
                    }
                  },
                  {
                    text: 'Data (più vecchie)',
                    onPress: () => {
                      const sorted = [...filteredExpenses].sort((a, b) => 
                        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                      );
                      setFilteredExpenses(sorted);
                    }
                  },
                  {
                    text: 'Importo (maggiore)',
                    onPress: () => {
                      const sorted = [...filteredExpenses].sort((a, b) => b.amount - a.amount);
                      setFilteredExpenses(sorted);
                    }
                  },
                  {
                    text: 'Importo (minore)',
                    onPress: () => {
                      const sorted = [...filteredExpenses].sort((a, b) => a.amount - b.amount);
                      setFilteredExpenses(sorted);
                    }
                  },
                  {
                    text: 'Annulla',
                    style: 'cancel'
                  }
                ]
              );
            }}>
              <IconSymbol name="arrow.up.down" size={30} color="#666" />
            </TouchableOpacity>
          </View>

          {filteredExpenses.length === 0 ? (
            <View style={styles.emptyState}>
              {isSearching ? (
                <>
                  <IconSymbol name="magnifyingglass" size={60} color="#CCCCCC" />
                  <Text style={styles.emptyTitle}>Nessun risultato</Text>
                  <Text style={styles.emptySubtitle}>
                    Nessuna spesa trovata per "{searchQuery}"
                  </Text>
                  <TouchableOpacity 
                    style={styles.tryAgainButton}
                    onPress={clearSearch}
                  >
                    <Text style={styles.tryAgainText}>Cancella ricerca</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <IconSymbol 
                    name={
                      activeFilter === 'unpaid' ? "checkmark.circle" :
                      activeFilter === 'paid' ? "party.popper" :
                      activeFilter === 'mine' ? "person.circle" :
                      activeFilter === 'owed' ? "checkmark.circle" :
                      activeFilter === 'alreadyPaid' ? "checkmark.circle.fill" :
                      "eurosign.circle"
                    } 
                    size={60} 
                    color="#CCCCCC" 
                  />
                  <Text style={styles.emptyTitle}>
                    {activeFilter === 'unpaid' ? 'Tutte le spese sono saldate! 🎉' :
                     activeFilter === 'paid' ? 'Nessuna spesa saldata' :
                     activeFilter === 'mine' ? 'Nessuna spesa pagata da te' :
                     activeFilter === 'owed' ? 'Non devi pagare nessuna spesa! 🎉' :
                     activeFilter === 'alreadyPaid' ? 'Non hai ancora pagato nessuna spesa' :
                     'Nessuna spesa'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {activeFilter === 'unpaid' ? 'Tutti i debiti sono stati pagati' :
                     activeFilter === 'paid' ? 'Segna i debiti come pagati nelle singole spese' :
                     activeFilter === 'mine' ? 'Non hai pagato nessuna spesa in questo gruppo' :
                     activeFilter === 'owed' ? 'Sei in pari con tutti i conti' :
                     activeFilter === 'alreadyPaid' ? 'Devi ancora pagare qualche debito' :
                     'Questo gruppo non ha ancora spese'}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={styles.expensesList}>
              {filteredExpenses.map((expense, index) => {
                const isFullyPaid = isExpenseFullyPaid(expense);
                const isMyExpense = expense.paidBy._id === userId;
                const userIsParticipant = expense.splitBetween?.some(participant => {
                  const participantId = getParticipantId(participant);
                  return participantId === userId;
                });
                const userHasPaid = isDebtPaid(expense, userId, expense.paidBy._id);
                
                return (
                  <TouchableOpacity
                    key={expense._id}
                    style={[
                      styles.expenseCard,
                      isFullyPaid && styles.fullyPaidCard,
                      index === filteredExpenses.length - 1 && styles.lastCard
                    ]}
                    onPress={() => router.push({
                      pathname: '/pages/singleExpense',
                      params: {
                        expenseId: expense._id,
                        groupId: groupId,
                        description: expense.description,
                      },
                    })}
                  >
                    <View style={styles.expenseHeader}>
                      <View style={styles.expenseLeft}>
                        <View style={[
                          styles.expenseAvatar,
                          isFullyPaid && styles.fullyPaidAvatar,
                          isMyExpense && styles.myExpenseAvatar
                        ]}>
                          <IconSymbol 
                            name={
                              isFullyPaid ? "checkmark.circle.fill" :
                              isMyExpense ? "clock" :
                              "clock"
                            } 
                            size={24} 
                            color={
                              isFullyPaid ? "#188C65" :
                              isMyExpense ? "#FF9500" :
                              "#666"
                            } 
                          />
                        </View>
                        
                        <View style={styles.expenseInfo}>
                          <Text 
                            style={[
                              styles.expenseDescription,
                              isFullyPaid && styles.fullyPaidText
                            ]}
                            numberOfLines={2}
                          >
                            {expense.description}
                          </Text>
                          <View style={styles.expenseMeta}>
                            <View style={styles.expensePaidBy}>
                              <IconSymbol name="person.circle" size={12} color="#666" />
                              <Text style={styles.expensePaidByText}>
                                {expense.paidBy?.name || expense.paidBy?.username || 'Utente'}
                                {isMyExpense && ' (tu)'}
                              </Text>
                            </View>
                            <Text style={styles.expenseDate}>
                              {formatRelativeDate(expense.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.expenseRight}>
                        <Text style={[
                          styles.expenseAmount,
                          isFullyPaid && styles.fullyPaidAmount,
                          isMyExpense && styles.myExpenseAmount
                        ]}>
                          {expense.amount.toFixed(2)} €
                        </Text>
                        
                        {isFullyPaid ? (
                          <View style={styles.paidBadge}>
                            <IconSymbol name="checkmark.circle.fill" size={14} color="#188C65" />
                            <Text style={styles.paidText}>
                              {isMyExpense ? 'Tutti pagati' : 'Tutto saldato'}
                            </Text>
                          </View>
                        ) : isMyExpense ? (
                          <View style={styles.myBadge}>
                            <IconSymbol name="star" size={14} color="#FF9500" />
                            <Text style={styles.myText}>Pagata da te</Text>
                          </View>
                        ) : userIsParticipant ? (
                          userHasPaid ? (
                            <View style={styles.userPaidBadge}>
                              <IconSymbol name="checkmark.circle" size={14} color="#188C65" />
                              <Text style={styles.userPaidText}>Hai pagato</Text>
                            </View>
                          ) : (
                            <View style={styles.userOwesBadge}>
                              <IconSymbol name="exclamationmark.circle" size={14} color="#FF3B30" />
                              <Text style={styles.userOwesText}>Devi pagare</Text>
                            </View>
                          )
                        ) : null}
                        
                        <IconSymbol name="chevron.right" size={16} color="#999" />
                      </View>
                    </View>
                    
                    {/* SEZIONE DEBITI */}
                    <View style={styles.debtsSection}>
  <Text style={styles.debtsTitle}>
    {isMyExpense ? 
    "Ti devono:" : 
    `Debiti verso ${expense.paidBy.name || expense.paidBy.username}:`}
  </Text>
  
  <View style={styles.debtsList}>
    {expense.splitBetween
      ?.filter(participant => {
        const participantId = getParticipantId(participant);
        return participantId !== expense.paidBy._id;
      })
      .map((participant, index) => {
        const participantId = getParticipantId(participant);
        const participantName = getParticipantName(participant, groupMembers);
        const participantObj = getParticipantObject(participant, groupMembers);
        const hasPaid = isDebtPaid(expense, participantId, expense.paidBy._id);
        const isYou = participantId === userId;
        
        return (
          <View key={`${expense._id}-${participantId}-${index}`} style={styles.debtItem}>
            <View style={styles.debtLeft}>
              {/* Avatar con immagine profilo o iniziali */}
              {participantObj.profileImage ? (
                <Image 
                  source={{ uri: participantObj.profileImage }} 
                  style={[
                    styles.debtAvatarImage,
                    isYou && styles.youDebtAvatarImage,
                    hasPaid && styles.paidDebtAvatarImage
                  ]}
                />
              ) : (
                <View style={[
                  styles.debtAvatar,
                  isYou && styles.youDebtAvatar,
                  hasPaid && styles.paidDebtAvatar
                ]}>
                  <Text style={[
                    styles.debtAvatarText,
                    isYou && styles.youDebtAvatarText,
                    hasPaid && styles.paidDebtAvatarText
                  ]}>
                    {participantName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              
              <View style={styles.debtInfo}>
                <Text style={[
                  styles.debtName,
                  isYou && styles.youDebtName,
                  hasPaid && styles.paidDebtName
                ]}>
                  {participantName}
                  {isYou && ' (tu)'}
                </Text>
                <Text style={styles.debtRelationship}>
                  {hasPaid ? 
                    `ha già pagato ${expense.paidBy.name || expense.paidBy.username}` : 
                    isMyExpense ? 'ti deve' : `deve a ${expense.paidBy.name || expense.paidBy.username}`
                  }
                </Text>
              </View>
            </View>
            
            <View style={styles.debtRight}>
              <Text style={[
                styles.debtAmount,
                hasPaid && styles.paidDebtAmount
              ]}>
                {expense.amountPerPerson.toFixed(2)} €
              </Text>
              
              {hasPaid ? (
                <View style={styles.debtPaidBadge}>
                  <IconSymbol name="checkmark.circle.fill" size={12} color="#188C65" />
                  <Text style={styles.debtPaidText}>Pagato</Text>
                </View>
              ) : (
                <View style={styles.debtUnpaidBadge}>
                  <IconSymbol name="clock" size={12} color="#FF9500" />
                  <Text style={styles.debtUnpaidText}>Da pagare</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
                  </View>    
                      {/* RIEPILOGO DEBITI */}
                      {(() => {
                        const debtors = expense.splitBetween?.filter(participant => {
                          const participantId = getParticipantId(participant);
                          return participantId !== expense.paidBy._id;
                        }) || [];
                        const paidDebtors = expense.paidDebts?.filter(d => d.to === expense.paidBy._id).length || 0;
                        const unpaidDebtors = debtors.length - paidDebtors;
                        
                        if (debtors.length > 0) {
                          return (
                            <View style={[
                              styles.debtSummary,
                              paidDebtors === debtors.length && styles.allPaidSummary,
                              paidDebtors === 0 && styles.nonePaidSummary
                            ]}>
                              {isMyExpense ? (
                                <>
                                  <Text style={styles.debtSummaryText}>
                                    {paidDebtors === debtors.length ? (
                                      '🎉 Tutti ti hanno pagato!'
                                    ) : paidDebtors === 0 ? (
                                      `Nessuno ti ha ancora pagato`
                                    ) : (
                                      `${paidDebtors}/${debtors.length} ti ${paidDebtors === 1 ? 'ha pagato' : 'hanno pagato'}`
                                    )}
                                  </Text>
                                  {unpaidDebtors > 0 && (
                                    <Text style={styles.debtSummarySubtext}>
                                      Devi ricevere ancora {unpaidDebtors} pagamento{unpaidDebtors !== 1 ? 'i' : ''}
                                    </Text>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Text style={styles.debtSummaryText}>
                                    {paidDebtors === debtors.length ? (
                                      '🎉 Tutti hanno pagato!'
                                    ) : paidDebtors === 0 ? (
                                      `Nessuno ha ancora pagato ${expense.paidBy.name || expense.paidBy.username}`
                                    ) : (
                                      `${paidDebtors}/${debtors.length} ${paidDebtors === 1 ? 'ha pagato' : 'hanno pagato'} ${expense.paidBy.name || expense.paidBy.username}`
                                    )}
                                  </Text>
                                  {unpaidDebtors > 0 && (
                                    <Text style={styles.debtSummarySubtext}>
                                      Mancano {unpaidDebtors} pagamento{unpaidDebtors !== 1 ? 'i' : ''}
                                    </Text>
                                  )}
                                </>
                              )}
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                    
                    {/* Dettagli originali */}
                    <View style={styles.expenseDetails}>
                      {expense.amountPerPerson && (
                        <View style={styles.detailItem}>
                          <IconSymbol name="person.2" size={14} color="#666" />
                          <Text style={styles.detailText}>
                            {expense.amountPerPerson.toFixed(2)} € a testa
                          </Text>
                        </View>
                      )}
                      
                      {expense.splitBetween && (
                        <View style={styles.detailItem}>
                          <IconSymbol name="person.3" size={14} color="#666" />
                          <Text style={styles.detailText}>
                            {expense.splitBetween.length} partecipanti
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.detailItem}>
                        <IconSymbol name="calendar" size={14} color="#666" />
                        <Text style={styles.detailText}>
                          {formatDate(expense.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Pulsante per tornare al gruppo */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="arrow.left" size={18} color="#188C65" />
          <Text style={styles.backButtonText}>Torna al gruppo</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

// Gli stili rimangono esattamente come prima...
// [Inserisci qui tutti gli stili StyleSheet che hai già]

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  summarySection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#188C65',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filtersSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filtersList: {
    flexDirection: 'row',
  },
  filtersContent: {
    paddingRight: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
  },
  filterActive: {
    backgroundColor: '#188C65',
    borderColor: '#188C65',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  filterAllText: {
    marginLeft: 0,
  },
  filterActiveText: {
    color: '#FFFFFF',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  searchInfo: {
    marginTop: 8,
  },
  searchInfoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  expensesSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  tryAgainButton: {
    backgroundColor: '#188C65',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  tryAgainText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  expensesList: {
    gap: 12,
  },
  expenseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  fullyPaidCard: {
    backgroundColor: '#F0F9F6',
    borderColor: '#D1E7DD',
    borderWidth: 1,
  },
  lastCard: {
    marginBottom: 0,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseLeft: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  expenseAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fullyPaidAvatar: {
    backgroundColor: '#D1E7DD',
  },
  myExpenseAvatar: {
    backgroundColor: '#FFE8CC',
  },
  expenseInfo: {
    flex: 1,
    minWidth: 0,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  fullyPaidText: {
    color: '#188C65',
  },
  expenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  expensePaidBy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expensePaidByText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
  },
  expenseRight: {
    alignItems: 'flex-end',
    minWidth: 0,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  fullyPaidAmount: {
    color: '#188C65',
  },
  myExpenseAmount: {
    color: '#FF9500',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1E7DD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  paidText: {
    fontSize: 11,
    color: '#188C65',
    fontWeight: '600',
    marginLeft: 4,
  },
  myBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  myText: {
    fontSize: 11,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 4,
  },
  userPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1E7DD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  userPaidText: {
    fontSize: 11,
    color: '#188C65',
    fontWeight: '600',
    marginLeft: 4,
  },
  userOwesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffd1d1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  userOwesText: {
    fontSize: 11,
    color: '#FF3B30',
    fontWeight: '600',
    marginLeft: 4,
  },
  debtsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  debtsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  debtsList: {
    gap: 8,
  },
  debtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 8,
  },
  debtLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  debtAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  youDebtAvatar: {
    backgroundColor: '#FFE8CC',
  },
  paidDebtAvatar: {
    backgroundColor: '#D1E7DD',
  },
  debtAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  youDebtAvatarText: {
    color: '#FF9500',
  },
  paidDebtAvatarText: {
    color: '#188C65',
  },
  debtInfo: {
    flex: 1,
    minWidth: 0,
  },
  debtName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  youDebtName: {
    color: '#FF9500',
  },
  paidDebtName: {
    color: '#188C65',
  },
  debtRelationship: {
    fontSize: 11,
    color: '#666',
  },
  debtRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
    minWidth: 0,
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'right',
  },
  paidDebtAmount: {
    color: '#188C65',
  },
  debtPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1E7DD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  debtPaidText: {
    fontSize: 10,
    color: '#188C65',
    fontWeight: '600',
    marginLeft: 2,
  },
  debtUnpaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  debtUnpaidText: {
    fontSize: 10,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 2,
  },
  debtSummary: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  allPaidSummary: {
    backgroundColor: '#D1E7DD',
    borderColor: '#A3CFBB',
  },
  nonePaidSummary: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFE699',
  },
  debtSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  debtSummarySubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  expenseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#188C65',
    marginLeft: 8,
  },
  // Stili per le immagini profilo nei debiti
debtAvatarImage: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#E0E0E0',
  marginRight: 8,
  borderWidth: 1,
  borderColor: '#E0E0E0',
},

youDebtAvatarImage: {
  borderColor: '#FF9500',
  backgroundColor: '#FFE8CC',
},

paidDebtAvatarImage: {
  borderColor: '#188C65',
  backgroundColor: '#D1E7DD',
},

});