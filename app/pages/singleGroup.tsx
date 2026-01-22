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
  Image,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';

const API_URL = 'http://10.178.160.160:3000';
const ModalAggiungiMembri = require('@/app/pages/ModalAggiungiMembri').default;
const ModalNuovaSpesa = require('@/app/pages/modalNuovaSpesa').default;


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
  createdAt: string;
  amountPerPerson: number;
  paidDebts?: Array<{ from: string; to: string }>;
  splitBetween?: GroupMember[];
}

export default function SingleGroup() {
  const params = useLocalSearchParams();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [groupBalances, setGroupBalances] = useState<Map<string, Map<string, number>>>(new Map());
  const [netBalances, setNetBalances] = useState<Map<string, number>>(new Map());
  
  // Stati per i modali
  const [modalAggiungiVisible, setModalAggiungiVisible] = useState(false);
  const [modalSpesaVisible, setModalSpesaVisible] = useState(false);
  const fadeAnimAggiungi = useRef(new Animated.Value(0)).current;
  const slideAnimAggiungi = useRef(new Animated.Value(200)).current;
  const fadeAnimSpesa = useRef(new Animated.Value(0)).current;
  const slideAnimSpesa = useRef(new Animated.Value(200)).current;
  
  // Stati per la modifica del nome
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isChangingName, setIsChangingName] = useState(false);
  
  // Stati per l'immagine del gruppo
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const groupId = params.groupId as string;
  const groupName = params.groupName as string;

useEffect(() => {
  if (group && group.expenses) {
    const balances = calculateGroupBalances(group.expenses);
    setGroupBalances(balances);
    
    // Calcola bilanci netti per ogni membro
    const netMap = new Map<string, number>();
    group.members?.forEach((member: GroupMember) => {
      netMap.set(member._id, getNetBalance(member._id, balances));
    });
    setNetBalances(netMap);
  }
}, [group]);

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
    if (userId && groupId) {
      loadGroupDetails();
    }
  }, [userId, groupId]);

const loadGroupDetails = async () => {
  try {
    setLoading(true);
    
    const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });

    const data = await response.json();

    if (data.success) {
      console.log('=== DATI MEMBRI RICEVUTI ===');
      console.log('Numero membri:', data.group.members?.length);
      
      // Log di ogni membro con i suoi dati
      if (data.group.members) {
        data.group.members.forEach((member: any, i: number) => {
          console.log(`Membro ${i}:`, {
            id: member._id,
            name: member.name,
            surname: member.surname,
            username: member.username,
            profileImage: member.profileImage, // <-- QUESTO È IL CAMPO IMPORTANTE
            hasProfileImage: !!member.profileImage
          });
        });
      }
      
      setGroup(data.group);
      
      if (data.group.image) {
        setGroupImage(data.group.image);
      }
    } else {
      Alert.alert('Errore', data.error || 'Impossibile caricare il gruppo');
      router.back();
    }
  } catch (error) {
    console.error('Errore caricamento dettagli gruppo:', error);
    Alert.alert('Errore', 'Impossibile connettersi al server');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};

// Funzione per calcolare tutti i debiti tra i membri
const calculateDetailedDebts = () => {
  if (!group?.expenses || !group?.members) return [];
  
  // Definisci i tipi per gli oggetti
  const membersMap: Record<string, GroupMember> = {};
  group.members.forEach((member: GroupMember) => {
    membersMap[member._id] = member;
  });
  
  // Inizializza i bilanci per ogni membro
  const balances: Record<string, number> = {};
  group.members.forEach((member: GroupMember) => {
    balances[member._id] = 0;
  });
  
  // Calcola i bilanci da tutte le spese
  group.expenses.forEach((expense: Expense) => {
    const isPayer = (memberId: string) => memberId === expense.paidBy._id;
    const amountPerPerson = expense.amountPerPerson || 
      (expense.amount / (expense.splitBetween?.length || 1));
    
    expense.splitBetween?.forEach((participant: GroupMember) => {
      if (isPayer(participant._id)) {
        // Il pagatore riceve soldi dagli altri
        balances[participant._id] += expense.amount - amountPerPerson;
      } else {
        // I debitori devono soldi al pagatore
        balances[participant._id] -= amountPerPerson;
        
        // Controlla se questo debito è già stato pagato
        const isPaid = expense.paidDebts?.some(debt => 
          debt.from === participant._id && debt.to === expense.paidBy._id
        );
        
        // Se è stato pagato, aggiustiamo il bilancio
        if (isPaid) {
          balances[participant._id] += amountPerPerson;
          balances[expense.paidBy._id] -= amountPerPerson;
        }
      }
    });
  });
  
  // Interfaccia per debitore/creditore
  interface BalanceEntry {
    memberId: string;
    member: GroupMember;
    amount: number;
  }
  
  // Calcola debiti finali
  const debtors: BalanceEntry[] = [];
  const creditors: BalanceEntry[] = [];
  
  Object.entries(balances).forEach(([memberId, balance]) => {
    if (balance < -0.01) { // Debitore (deve soldi)
      debtors.push({
        memberId,
        member: membersMap[memberId],
        amount: Math.abs(balance)
      });
    } else if (balance > 0.01) { // Creditore (deve ricevere)
      creditors.push({
        memberId,
        member: membersMap[memberId],
        amount: balance
      });
    }
  });
  
  // Ordina per importo (dal più grande al più piccolo)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  
  interface SimplifiedDebt {
  from: GroupMember;
  to: GroupMember;
  amount: number;
  expenseDescription?: string;  // Aggiungi questa linea se hai bisogno della descrizione
  expenseId?: string;  // Opzionale: ID della spesa se vuoi collegarla
}
  
  // Calcola chi deve a chi (semplificato)
  const simplifiedDebts: SimplifiedDebt[] = [];
  
  // Clona gli array per non modificare gli originali
  const debtorsCopy = debtors.map(d => ({ ...d, amount: d.amount }));
  const creditorsCopy = creditors.map(c => ({ ...c, amount: c.amount }));
  
  let i = 0, j = 0;
  while (i < debtorsCopy.length && j < creditorsCopy.length) {
    const debtor = debtorsCopy[i];
    const creditor = creditorsCopy[j];
    
    const amount = Math.min(debtor.amount, creditor.amount);
    
    if (amount > 0.01) {
      simplifiedDebts.push({
        from: debtor.member,
        to: creditor.member,
        amount: parseFloat(amount.toFixed(2))
      });
      
      debtor.amount -= amount;
      creditor.amount -= amount;
    }
    
    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }
  
  return simplifiedDebts;
};

  const onRefresh = () => {
    setRefreshing(true);
    loadGroupDetails();
  };

  // Funzioni per i modali
  const openModalAggiungi = () => {
    setModalAggiungiVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnimAggiungi, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnimAggiungi, { toValue: 0, bounciness: 5, useNativeDriver: true }),
    ]).start();
  };

  const closeModalAggiungi = () => {
    Animated.parallel([
      Animated.timing(fadeAnimAggiungi, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnimAggiungi, { toValue: 800, duration: 200, useNativeDriver: true }),
    ]).start(() => setModalAggiungiVisible(false));
  };

  const openModalSpesa = () => {
    setModalSpesaVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnimSpesa, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnimSpesa, { toValue: 0, bounciness: 5, useNativeDriver: true }),
    ]).start();
  };

  const closeModalSpesa = () => {
    Animated.parallel([
      Animated.timing(fadeAnimSpesa, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnimSpesa, { toValue: 800, duration: 200, useNativeDriver: true }),
    ]).start(() => setModalSpesaVisible(false));
  };

  const handleMembersAdded = () => {
    loadGroupDetails();
  };

  const handleExpenseCreated = () => {
    loadGroupDetails();
  };

  // Funzioni per l'immagine del gruppo
  const showImagePickerMenu = () => {
    if (group?.createdBy?._id !== userId) {
      Alert.alert('Errore', 'Solo il creatore del gruppo può cambiare l\'icona');
      return;
    }

    Alert.alert(
      'Cambia icona gruppo',
      'Come vuoi cambiare l\'icona del gruppo?',
      [
        {
          text: 'Scatta una foto',
          onPress: takePhoto
        },
        {
          text: 'Scegli dalla galleria',
          onPress: pickImage
        },
        {
          text: 'Rimuovi immagine',
          style: 'destructive',
          onPress: removeGroupImage
        },
        {
          text: 'Annulla',
          style: 'cancel'
        }
      ]
    );
  };

  const requestCameraPermissionAsync = async () => {
    const { granted } = await requestCameraPermission();
    return granted;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissionAsync();
    if (!hasPermission) {
      Alert.alert(
        'Permesso richiesto',
        'Per scattare una foto è necessario concedere l\'accesso alla fotocamera',
        [
          {
            text: 'Annulla',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        await uploadGroupImage(selectedImage.uri);
      }
    } catch (error) {
      console.error('Errore scatto foto:', error);
      Alert.alert('Errore', 'Impossibile scattare la foto');
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permesso richiesto',
        'Per selezionare un\'immagine è necessario concedere l\'accesso alla galleria',
        [
          {
            text: 'Annulla',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        await uploadGroupImage(selectedImage.uri);
      }
    } catch (error) {
      console.error('Errore selezione immagine:', error);
      Alert.alert('Errore', 'Impossibile selezionare l\'immagine');
    }
  };

  const uploadGroupImage = async (imageUri: string) => {
    if (!groupId || !userId) {
      Alert.alert('Errore', 'Dati mancanti per il caricamento');
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      
      const imageFile = {
        uri: imageUri,
        type: 'image/jpeg',
        name: `group_${groupId}_${Date.now()}.jpg`,
      };
      
      formData.append('image', imageFile as any);

      const response = await fetch(`${API_URL}/api/groups/${groupId}/upload-image`, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Successo', 'Immagine del gruppo aggiornata con successo');
        setGroupImage(data.imageUrl);
        setGroup((prev: any) => ({ ...prev, image: data.imageUrl }));
      } else {
        Alert.alert('Errore', data.error || 'Impossibile caricare l\'immagine');
      }
    } catch (error) {
      console.error('Errore caricamento immagine:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeGroupImage = async () => {
    if (!groupId || !userId) {
      return;
    }

    Alert.alert(
      'Rimuovi immagine',
      'Sei sicuro di voler rimuovere l\'immagine del gruppo?',
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
              const response = await fetch(`${API_URL}/api/groups/${groupId}/remove-image`, {
                method: 'DELETE',
                headers: {
                  'x-user-id': userId,
                  'Content-Type': 'application/json',
                },
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Successo', 'Immagine rimossa con successo');
                setGroupImage(null);
                setGroup((prev: any) => ({ ...prev, image: null }));
              } else {
                Alert.alert('Errore', data.error || 'Impossibile rimuovere l\'immagine');
              }
            } catch (error) {
              console.error('Errore rimozione immagine:', error);
              Alert.alert('Errore', 'Impossibile connettersi al server');
            }
          }
        }
      ]
    );
  };

  // Funzione per rimuovere un membro
  const rimuoviMembro = (memberId: string, memberName: string) => {
  if (!group) return;

  // Controlla se l'utente corrente è il creatore del gruppo
  if (group.createdBy?._id !== userId) {
    Alert.alert('Errore', 'Solo il creatore del gruppo può rimuovere membri');
    return;
  }

  if (group.createdBy?._id === memberId) {
    Alert.alert('Errore', 'Non puoi rimuovere il creatore del gruppo');
    return;
  }

  if (memberId === userId) {
    Alert.alert('Errore', 'Non puoi rimuovere te stesso dal gruppo');
    return;
  }

  Alert.alert(
    'Rimuovi membro',
    `Sei sicuro di voler rimuovere ${memberName} dal gruppo?`,
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
            const response = await fetch(`${API_URL}/api/groups/${groupId}/remove-member`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
              },
              body: JSON.stringify({ memberId }),
            });

            const data = await response.json();

            if (data.success) {
              Alert.alert('Successo', data.message);
              loadGroupDetails();
            } else {
              Alert.alert('Errore', data.error || 'Impossibile rimuovere il membro');
            }
          } catch (error) {
            console.error('Errore rimozione membro:', error);
            Alert.alert('Errore', 'Impossibile connettersi al server');
          }
        }
      }
    ]
  );
};

  const mostraMenuMembro = (member: GroupMember) => {
  if (!group) return;
  
  // Se non è il creatore, non mostrare il menu per rimuovere
  if (group.createdBy?._id !== userId) {
    return;
  }

  // Se è il creatore stesso o l'utente stesso, non mostrare menu
  if (member._id === group.createdBy?._id || member._id === userId) {
    return;
  }

  Alert.alert(
    `Azioni per ${member.name} ${member.surname}`,
    undefined,
    [
      {
        text: 'Rimuovi dal gruppo',
        style: 'destructive',
        onPress: () => rimuoviMembro(member._id, `${member.name} ${member.surname}`)
      },
      {
        text: 'Annulla',
        style: 'cancel'
      }
    ]
  );
};

  // Funzioni per modificare il nome del gruppo
  const startEditingName = () => {
    if (!group) return;
    setIsEditingName(true);
    setNewGroupName(group.name || '');
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setNewGroupName('');
  };

  const saveGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Errore', 'Il nome del gruppo non può essere vuoto');
      return;
    }

    if (!group || newGroupName.trim() === group.name) {
      setIsEditingName(false);
      setNewGroupName('');
      return;
    }

    setIsChangingName(true);
    
    try {
      const response = await fetch(`${API_URL}/api/groups/${groupId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Successo', 'Nome gruppo aggiornato con successo');
        setGroup((prev: any) => ({ ...prev, name: newGroupName.trim() }));
        setIsEditingName(false);
        setNewGroupName('');
      } else {
        Alert.alert('Errore', data.error || 'Impossibile aggiornare il nome del gruppo');
      }
    } catch (error) {
      console.error('Errore aggiornamento nome gruppo:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setIsChangingName(false);
    }
  };

  const confirmChangeName = () => {
    Alert.alert(
      'Cambia nome gruppo',
      `Vuoi cambiare il nome del gruppo da "${group?.name}" a "${newGroupName}"?`,
      [
        {
          text: 'Annulla',
          style: 'cancel',
          onPress: cancelEditingName
        },
        {
          text: 'Cambia',
          onPress: saveGroupName
        }
      ]
    );
  };

  const showGroupNameMenu = () => {
    Alert.alert(
      'Modifica gruppo',
      undefined,
      [
        {
          text: 'Cambia nome',
          onPress: startEditingName
        },
        {
          text: 'Cambia icona',
          onPress: showImagePickerMenu
        },
        {
          text: 'Annulla',
          style: 'cancel'
        }
      ]
    );
  };

  // Funzioni per formattare date
  const formatDate = (dateInput: any): string => {
    try {
      if (typeof dateInput === 'string' && dateInput.includes('/')) {
        return dateInput;
      }
      
      let date: Date;
      
      if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else if (typeof dateInput === 'number') {
        date = new Date(dateInput);
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else {
        return 'Data non disponibile';
      }
      
      if (isNaN(date.getTime())) {
        return 'Data non valida';
      }
      
      return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return 'Data non disponibile';
    }
  };

  const formatShortDate = (dateInput: any): string => {
    try {
      let date: Date;
      
      if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else if (typeof dateInput === 'number') {
        date = new Date(dateInput);
      } else if (dateInput instanceof Date) {
        date = dateInput;
      } else {
        return '--/--';
      }
      
      if (isNaN(date.getTime())) {
        return '--/--';
      }
      
      return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit'
      });
    } catch (error) {
      return '--/--';
    }
  };

  // Funzione per verificare se una spesa è completamente pagata
  const isExpenseFullyPaid = (expense: Expense): boolean => {
    if (!expense.paidDebts || !expense.splitBetween) return false;
    
    // Per ogni partecipante che non è il pagatore
    const debtors = expense.splitBetween.filter(member => 
      member._id !== expense.paidBy._id
    );
    
    // Conta quanti debiti verso il pagatore sono stati pagati
    const paidDebtsCount = expense.paidDebts.filter(debt => 
      debt.to === expense.paidBy._id
    ).length;
    
    // La spesa è completamente pagata se tutti i debitori hanno pagato
    return paidDebtsCount === debtors.length;
  };


  
// Funzione per calcolare i bilanci tra i membri
const calculateGroupBalances = (expenses: Expense[]): Map<string, Map<string, number>> => {
  const balances = new Map<string, Map<string, number>>();
  
  
  expenses.forEach(expense => {
    const payerId = expense.paidBy._id;
    
    // Per ogni debitore (tutti tranne il pagatore)
    expense.splitBetween?.forEach(debtor => {
      if (debtor._id === payerId) return;
      
      // Se il debito è stato pagato, non lo contiamo
      const isDebtPaid = expense.paidDebts?.some(d => 
        d.from === debtor._id && d.to === payerId
      );
      
      if (!isDebtPaid) {
        // Aggiungi al debito del debitore verso il pagatore
        if (!balances.has(debtor._id)) {
          balances.set(debtor._id, new Map());
        }
        const debtorBalances = balances.get(debtor._id)!;
        
        const currentDebt = debtorBalances.get(payerId) || 0;
        debtorBalances.set(payerId, currentDebt + expense.amountPerPerson!);
      }
    });
  });
  
  return balances;
};

// Funzione per calcolare i bilanci netti tra membri - VERSIONE CORRETTA
const calculateNetBalances = (expenses: Expense[], members: GroupMember[]) => {
  console.log('=== CALCOLO BILANCI ===');
  console.log('Numero spese:', expenses.length);
  console.log('Numero membri:', members.length);
  
  if (!expenses || expenses.length === 0 || !members || members.length === 0) {
    console.log('Nessuna spesa o membri - ritorno mappa vuota');
    return new Map<string, number>();
  }
  
  const balances = new Map<string, number>();
  
  // Inizializza tutti i membri a 0
  members.forEach(member => {
    balances.set(member._id, 0);
  });
  console.log('Membri inizializzati:', Array.from(balances.entries()));
  
  // Calcola i bilanci dalle spese
  expenses.forEach((expense, index) => {
    console.log(`\n--- Spesa ${index + 1}: ${expense.description} ---`);
    console.log('Pagatore:', expense.paidBy.name, `(ID: ${expense.paidBy._id})`);
    console.log('Importo totale:', expense.amount);
    console.log('A testa:', expense.amountPerPerson);
    console.log('Partecipanti:', expense.splitBetween?.map(p => p.name).join(', '));
    console.log('Debiti pagati (paidDebts):', expense.paidDebts || 'nessuno');
    
    if (!expense.splitBetween || !expense.amountPerPerson) {
      console.log('ERRORE: splitBetween o amountPerPerson mancante!');
      return;
    }
    
    const creditorId = expense.paidBy._id;
    
    expense.splitBetween.forEach((participant, pIndex) => {
      if (participant._id === creditorId) {
        // Il pagatore
        console.log(`\n${participant.name} è il pagatore`);
        
        // Calcola quanto deve ricevere da chi non ha pagato
        let toReceive = 0;
        
        expense.splitBetween?.forEach(debtor => {
          if (debtor._id !== creditorId) {
            // Controlla se questo debito è pagato
            const isPaid = expense.paidDebts?.some(d => 
              d.from === debtor._id && d.to === creditorId
            );
            
            console.log(`  - ${debtor.name} deve ${expense.amountPerPerson}€: ${isPaid ? 'PAGATO' : 'DA PAGARE'}`);
            
            if (!isPaid) {
              toReceive += expense.amountPerPerson;
            }
          }
        });
        
        const current = balances.get(creditorId) || 0;
        balances.set(creditorId, current + toReceive);
        console.log(`  ${participant.name} ora deve ricevere: ${current + toReceive}€`);
        
      } else {
        // Il debitore
        const isPaid = expense.paidDebts?.some(d => 
          d.from === participant._id && d.to === creditorId
        );
        
        console.log(`\n${participant.name} è debitore: ${isPaid ? 'HA PAGATO' : 'DEVE PAGARE'}`);
        
        if (!isPaid) {
          const current = balances.get(participant._id) || 0;
          const newBalance = current - expense.amountPerPerson;
          balances.set(participant._id, newBalance);
          console.log(`  ${participant.name} ora deve: ${newBalance}€`);
        } else {
          console.log(`  ${participant.name} ha già pagato, bilancio non cambia`);
        }
      }
    });
  });
  
  console.log('\n=== BILANCI FINALI ===');
  balances.forEach((balance, memberId) => {
    const member = members.find(m => m._id === memberId);
    console.log(`${member?.name}: ${balance.toFixed(2)}€`);
  });
  
  return balances;
};

// Funzione per verificare se tutte le spese sono completamente pagate
const areAllExpensesPaid = (expenses: Expense[]): boolean => {
  if (!expenses || expenses.length === 0) return false;
  
  return expenses.every(expense => {
    if (!expense.splitBetween || !expense.paidDebts) return false;
    
    const debtors = expense.splitBetween.filter(member => 
      member._id !== expense.paidBy._id
    );
    
    const paidDebtsCount = expense.paidDebts.filter(debt => 
      debt.to === expense.paidBy._id
    ).length;
    
    return paidDebtsCount === debtors.length;
  });
};

// Funzione per ottenere le spese non completamente pagate
const getUnpaidExpenses = (expenses: Expense[]): Expense[] => {
  if (!expenses) return [];
  
  return expenses.filter(expense => !isExpenseFullyPaid(expense));
};



// Funzione per ottenere il bilancio netto di un utente
const getNetBalance = (userId: string, balances: Map<string, Map<string, number>>): number => {
  let total = 0;
  
  // Debiti che l'utente deve agli altri
  const userDebts = balances.get(userId);
  if (userDebts) {
    userDebts.forEach(amount => {
      total -= amount;
    });
  }
  
  // Debiti che gli altri devono all'utente
  balances.forEach((debtors, creditorId) => {
    if (debtors.has(userId)) {
      total += debtors.get(userId)!;
    }
  });
  
  return total;
};

  const formatRelativeDate = (dateInput: any): string => {
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return '--/--';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Oggi';
      if (diffDays === 1) return 'Ieri';
      if (diffDays < 7) return `${diffDays} giorni fa`;
      
      return date.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short'
      });
    } catch (error) {
      return '--/--';
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: groupName || 'Gruppo', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#188C65" />
          <Text style={styles.loadingText}>Caricamento gruppo...</Text>
        </View>
      </>
    );
  }

  if (!group) {
    return (
      <View style={styles.errorContainer}>
        <IconSymbol name="exclamationmark.triangle" size={50} color="#FF9500" />
        <Text style={styles.errorText}>Gruppo non trovato</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: group.name || 'Gruppo',
        headerShown: true,
        headerBackTitle: 'Gruppi',
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
        {/* Header del Gruppo */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.groupAvatarContainer}
            onPress={showImagePickerMenu}
            disabled={uploadingImage}
            activeOpacity={0.7}
          >
            {uploadingImage ? (
              <View style={styles.groupAvatar}>
                <ActivityIndicator size="small" color="#188C65" />
              </View>
            ) : groupImage ? (
              <Image 
                source={{ uri: groupImage }} 
                style={styles.groupImage}
              />
            ) : (
              <View style={styles.groupAvatar}>
                <Text style={styles.groupAvatarText}>
                  {group.name?.charAt(0)?.toUpperCase() || 'G'}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <IconSymbol name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          
          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <View style={styles.inputContainer}>
                <IconSymbol name="pencil" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.nameInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="Nuovo nome gruppo"
                  autoFocus={true}
                  maxLength={50}
                  onSubmitEditing={confirmChangeName}
                />
              </View>
              <View style={styles.editButtons}>
                <TouchableOpacity 
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={cancelEditingName}
                  disabled={isChangingName}
                >
                  <IconSymbol name="xmark" size={16} color="#666" />
                  <Text style={styles.cancelButtonText}>Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.editButton, styles.saveButton]}
                  onPress={confirmChangeName}
                  disabled={isChangingName || !newGroupName.trim()}
                >
                  {isChangingName ? (
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
              style={styles.nameContainer}
              onPress={showGroupNameMenu}
              activeOpacity={0.7}
            >
              <Text style={styles.groupName}>{group.name || 'Gruppo senza nome'}</Text>
              <View style={styles.editIconContainer}>
                <IconSymbol name="pencil" size={18} color="#666" />
              </View>
            </TouchableOpacity>
          )}
          
          {group.description && (
            <Text style={styles.groupDescription}>{group.description}</Text>
          )}
          
          {group.createdAt && (
            <View style={styles.creationInfo}>
              <IconSymbol name="calendar" size={16} color="#666" />
              <Text style={styles.creationDate}>
                Creato il {formatDate(group.createdAt)}
              </Text>
            </View>
          )}
          
          <View style={styles.groupStats}>
            <View style={styles.stat}>
              <IconSymbol name="person.2" size={20} color="#666" />
              <Text style={styles.statNumber}>{group.members?.length || 0}</Text>
              <Text style={styles.statLabel}>Membri</Text>
            </View>
            
            <View style={styles.stat}>
              <IconSymbol name="dollarsign.circle" size={20} color="#666" />
              <Text style={styles.statNumber}>
                {(group.totalExpenses || 0).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Spese</Text>
            </View>
            
            <View style={styles.stat}>
              <IconSymbol name="clock" size={20} color="#666" />
              <Text style={styles.statNumber}>
                {formatShortDate(group.updatedAt || group.createdAt)}
              </Text>
              <Text style={styles.statLabel}>Aggiornato</Text>
            </View>
          </View>
        </View>

        {/* Membri del Gruppo */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Membri ({group.members?.length || 0})</Text>
            <TouchableOpacity onPress={openModalAggiungi}>
              <IconSymbol name="plus" size={20} color="#188C65" />
            </TouchableOpacity>
          </View>
          
          {group.members && group.members.length > 0 ? (
  group.members.map((member: GroupMember) => (
    <TouchableOpacity 
      key={member._id} 
      style={styles.memberItem}
      onPress={() => mostraMenuMembro(member)}
      activeOpacity={0.7}
    >
      <View style={styles.memberLeft}>
        {/* Avatar con immagine profilo o iniziali */}
        {member.profileImage ? (
          <Image 
            source={{ uri: member.profileImage }} 
            style={styles.memberAvatarImage}
          />
        ) : (
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {member.name?.charAt(0)}{member.surname?.charAt(0)}
            </Text>
          </View>
        )}
        
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>
            {member.name || ''} {member.surname || ''}
          </Text>
          <Text style={styles.memberUsername}>@{member.username}</Text>
        </View>
      </View>
      
      <View style={styles.memberRight}>
        {member._id === group.createdBy?._id && (
          <View style={styles.creatorBadge}>
            <IconSymbol name="star.fill" size={14} color="#FF9500" />
            <Text style={styles.creatorText}>Creatore</Text>
          </View>
        )}
        
        {member._id === userId && (
          <View style={styles.youBadge}>
            <Text style={styles.youText}>Tu</Text>
          </View>
        )}
        
        {/* Mostra il pulsante per rimuovere SOLO se l'utente corrente è il creatore */}
        {group.createdBy?._id === userId && 
         member._id !== group.createdBy?._id && 
         member._id !== userId && (
          <TouchableOpacity 
            style={styles.removeButton}
            onPress={() => rimuoviMembro(member._id, `${member.name} ${member.surname}`)}
          >
            <IconSymbol name="xmark" size={20} color="#DC3545" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  ))
) : (
  <View style={styles.emptyMembers}>
    <IconSymbol name="person.slash" size={24} color="#CCC" />
    <Text style={styles.emptyText}>Nessun membro trovato</Text>
  </View>
)}
          
        </View>

        {/* Spese Recenti */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Spese Recenti</Text>
            <TouchableOpacity onPress={openModalSpesa}>
              <IconSymbol name="plus" size={20} color="#188C65" />
            </TouchableOpacity>
          </View>
          
          {group.expenses && group.expenses.length > 0 ? (
            <View style={styles.expensesList}>
              {group.expenses.slice(0, 3).map((expense: Expense) => (
              <TouchableOpacity 
                key={expense._id} 
                style={[
                  styles.expenseItem,
                  isExpenseFullyPaid(expense) && styles.fullyPaidExpenseItem
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
                  <View style={styles.expenseInfo}>
                    <Text style={[
                      styles.expenseDescription, 
                      isExpenseFullyPaid(expense) && styles.fullyPaidText
                    ]} numberOfLines={1}>
                      {expense.description}
                    </Text>
                    <Text style={[
                      styles.expenseAmount,
                      isExpenseFullyPaid(expense) && styles.fullyPaidAmount
                    ]}>
                      {expense.amount.toFixed(2)} €
                    </Text>
                  </View>
                  
                  {isExpenseFullyPaid(expense) && (
                    <View style={styles.fullyPaidBadge}>
                      <IconSymbol name="checkmark.circle.fill" size={14} color="#188C65" />
                      <Text style={styles.fullyPaidBadgeText}>Saldata</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.expenseDetails}>
                  <Text style={[
                    styles.expensePaidBy,
                    isExpenseFullyPaid(expense) && styles.fullyPaidDetail
                  ]} numberOfLines={1}>
                    Pagato da {expense.paidBy?.name || 'Utente'}
                  </Text>
                  {expense.amountPerPerson && (
                    <Text style={[
                      styles.expenseSplit,
                      isExpenseFullyPaid(expense) && styles.fullyPaidDetail
                    ]}>
                      {expense.amountPerPerson.toFixed(2)} € a testa
                    </Text>
                  )}
                  <Text style={[
                    styles.expenseDate,
                    isExpenseFullyPaid(expense) && styles.fullyPaidDetail
                  ]}>
                    {formatRelativeDate(expense.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
              ))}
              
              {group.expenses.length > 3 && (
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => router.push({
                    pathname: '/pages/allExpenses',
                    params: {
                      groupId: groupId,
                      groupName: group.name,
                    },
                  })}
                >
                  <Text style={styles.viewAllText}>Vedi tutte le spese</Text>
                  <IconSymbol name="chevron.right" size={16} color="#188C65" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <IconSymbol name="euro" size={40} color="#CCCCCC" />
              <Text style={styles.emptySectionText}>Nessuna spesa ancora</Text>
              <Text style={styles.emptySectionHint}>
                Aggiungi la prima spesa al gruppo
              </Text>
            </View>
          )}
        </View>

        {/* SEZIONE DEBITI DA SALDARE */}
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Debiti da Saldare</Text>
    <TouchableOpacity onPress={() => Alert.alert('Info', 'Questo è il totale di tutti i debiti ancora da pagare nel gruppo')}>
      <IconSymbol name="info.circle" size={20} color="#666" />
    </TouchableOpacity>
  </View>
  
  {(() => {
    if (!group.expenses || group.expenses.length === 0) {
      return (
        <View style={styles.noDebtsContainer}>
          <IconSymbol name="checkmark.circle.fill" size={30} color="#CCCCCC" />
          <Text style={styles.noDebtsText}>Nessuna spesa con debiti</Text>
        </View>
      );
    }
    
    // Calcola il totale dei debiti non pagati
    let totalUnpaid = 0;
    let unpaidExpensesCount = 0;
    let totalDebts = 0;
    
    group.expenses.forEach((expense: Expense) => {
      if (!expense.splitBetween || !expense.amountPerPerson) return;
      
      // Per ogni spesa, calcola quanto non è stato pagato
      const creditorId = expense.paidBy._id;
      const perPerson = expense.amountPerPerson;
      
      expense.splitBetween.forEach(participant => {
        if (participant._id !== creditorId) {
          // Conta tutti i debiti potenziali
          totalDebts += perPerson;
          
          // Controlla se questo debito è stato pagato
          const isPaid = expense.paidDebts?.some(debt => 
            debt.from === participant._id && debt.to === creditorId
          );
          
          if (!isPaid) {
            totalUnpaid += perPerson;
          }
        }
      });
    });
    
    // Calcola quante spese hanno debiti non pagati
    unpaidExpensesCount = group.expenses.filter((expense: Expense) => {
      if (!expense.splitBetween) return false;
      
      const debtors = expense.splitBetween.filter(member => 
        member._id !== expense.paidBy._id
      );
      
      const paidDebtsCount = expense.paidDebts?.filter(debt => 
        debt.to === expense.paidBy._id
      ).length || 0;
      
      return paidDebtsCount < debtors.length;
    }).length;
    
    // Se tutti i debiti sono pagati
    if (totalUnpaid === 0) {
      return (
        <View style={styles.allPaidContainer}>
          <IconSymbol name="party.popper.fill" size={40} color="#188C65" />
          <Text style={styles.allPaidTitle}>🎉 Tutto saldato!</Text>
          <Text style={styles.allPaidText}>
            Tutti i debiti del gruppo sono stati pagati
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{group.expenses.length}</Text>
              <Text style={styles.statLabel}>Spese totali</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>
                {(group.totalExpenses || 0).toFixed(2)}€
              </Text>
              <Text style={styles.statLabel}>Importo totale</Text>
            </View>
          </View>
        </View>
      );
    }
    
    // Calcola percentuale pagata
    const paidPercentage = totalDebts > 0 
      ? Math.round(((totalDebts - totalUnpaid) / totalDebts) * 100) 
      : 0;
    
    // Trova i debitori principali
    const debtorsMap = new Map<string, number>();
    
    group.expenses.forEach((expense: Expense) => {
      if (!expense.splitBetween || !expense.amountPerPerson) return;
      
      const creditorId = expense.paidBy._id;
      const perPerson = expense.amountPerPerson;
      
      expense.splitBetween.forEach(participant => {
        if (participant._id !== creditorId) {
          const isPaid = expense.paidDebts?.some(debt => 
            debt.from === participant._id && debt.to === creditorId
          );
          
          if (!isPaid) {
            const current = debtorsMap.get(participant._id) || 0;
            debtorsMap.set(participant._id, current + perPerson);
          }
        }
      });
    });
    
    // Converti la mappa in array e ordina
    const topDebtors = Array.from(debtorsMap.entries())
      .map(([memberId, amount]) => {
        const member = group.members?.find((m: GroupMember) => m._id === memberId);
        return {
          member: member || { _id: memberId, name: 'Utente' },
          amount
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3); // Prendi i top 3
    
    return (
      <View>
        {/* Riepilogo principale */}
        <View style={styles.debtsSummary}>
          <View style={styles.totalDebtBox}>
            <Text style={styles.totalDebtLabel}>Totale da pagare:</Text>
            <Text style={styles.totalDebtAmount}>
              {totalUnpaid.toFixed(2)} €
            </Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${paidPercentage}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {paidPercentage}% pagato
              </Text>
            </View>
          </View>
          
          <View style={styles.debtsStats}>
            <View style={styles.debtStat}>
              <IconSymbol name="exclamationmark.circle" size={18} color="#666" />
              <Text style={styles.debtStatNumber}>{unpaidExpensesCount}</Text>
              <Text style={styles.debtStatLabel}>Spese con debiti</Text>
            </View>
            
            <View style={styles.debtStat}>
              <IconSymbol name="person.2" size={18} color="#666" />
              <Text style={styles.debtStatNumber}>{debtorsMap.size}</Text>
              <Text style={styles.debtStatLabel}>Debitori</Text>
            </View>
            
            <View style={styles.debtStat}>
              <IconSymbol name="checkmark.circle" size={18} color="#666" />
              <Text style={styles.debtStatNumber}>
                {(totalDebts - totalUnpaid).toFixed(0)}€
              </Text>
              <Text style={styles.debtStatLabel}>Già pagato</Text>
            </View>
          </View>
        </View>
        
        {/* Top debitori */}
        {topDebtors.length > 0 && (
  <View style={styles.topDebtorsSection}>
    <Text style={styles.topDebtorsTitle}>Principali debitori:</Text>
    <View style={styles.topDebtorsList}>
      {topDebtors.map((debtor, index) => (
        <View key={debtor.member._id} style={styles.debtorItem}>
          <View style={styles.debtorLeft}>
            <View style={[
              styles.debtorRank,
              index === 0 && styles.firstRank,
              index === 1 && styles.secondRank,
              index === 2 && styles.thirdRank
            ]}>
              <Text style={styles.debtorRankText}>#{index + 1}</Text>
            </View>
            
            {/* Avatar con immagine profilo o iniziali */}
            {debtor.member.profileImage ? (
              <Image 
                source={{ uri: debtor.member.profileImage }} 
                style={styles.debtorAvatarImage}
              />
            ) : (
              <View style={styles.debtorAvatar}>
                <Text style={styles.debtorAvatarText}>
                  {debtor.member.name?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            
            <View style={styles.debtorInfo}>
              <Text style={styles.debtorName}>
                {debtor.member.name || 'Utente'}
                {debtor.member._id === userId && <Text style={styles.youIndicator}> (tu)</Text>}
              </Text>
              <Text style={styles.debtorUsername}>
                @{debtor.member.username}
              </Text>
            </View>
          </View>
          <Text style={styles.debtorAmount}>
            {debtor.amount.toFixed(2)} €
          </Text>
        </View>
      ))}
    </View>
  </View>
)}
        
        {/* Azione rapida */}
        <TouchableOpacity 
          style={styles.settleButton}
          onPress={() => {
            Alert.alert(
              'Saldi i debiti',
              'Vuoi inviare promemoria ai debitori?',
              [
                { text: 'Annulla', style: 'cancel' },
                { 
                  text: 'Invia promemoria', 
                  onPress: () => {
                    Alert.alert('Successo', 'Promemoria inviati ai debitori');
                  }
                }
              ]
            );
          }}
        >
          <IconSymbol name="bell" size={20} color="#FFFFFF" />
          <Text style={styles.settleButtonText}>Invia promemoria</Text>
        </TouchableOpacity>
        
        <Text style={styles.hintText}>
          💡 I debiti possono essere segnati come pagati nella pagina di ogni spesa
        </Text>
      </View>
    );
  })()}
</View>

        {/* Azioni */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={openModalSpesa}
          >
            <IconSymbol name="plus.circle" size={24} color="#188C65" />
            <Text style={styles.actionButtonText}>Nuova Spesa</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryAction]}
            onPress={openModalAggiungi}
          >
            <IconSymbol name="person.badge.plus" size={24} color="#666" />
            <Text style={[styles.actionButtonText, styles.secondaryActionText]}>Aggiungi Membro</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal per nuova spesa */}
      <ModalNuovaSpesa 
        visible={modalSpesaVisible}
        fadeAnim={fadeAnimSpesa}
        slideAnim={slideAnimSpesa}
        onClose={closeModalSpesa}
        groupId={groupId}
        groupName={group.name}
        members={group.members || []}
        userId={userId}
        onExpenseCreated={handleExpenseCreated}
      />

      {/* Modal per aggiungere membri */}
      <ModalAggiungiMembri 
        visible={modalAggiungiVisible}
        fadeAnim={fadeAnimAggiungi}
        slideAnim={slideAnimAggiungi}
        onClose={closeModalAggiungi}
        groupId={groupId}
        groupName={group.name}
        currentMembers={group.members || []}
        onMembersAdded={handleMembersAdded}
      />
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
  groupAvatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(24,140,101,0.2)',
  },
  groupImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(24,140,101,0.2)',
  },
  groupAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: 'rgba(24,140,101,1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(24,140,101,0.05)',
  },
  groupName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  nameEditContainer: {
    width: '100%',
    marginBottom: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    padding: 0,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    minWidth: 100,
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
  editIconContainer: {
    marginLeft: 8,
    padding: 4,
  },
  groupDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  creationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  creationDate: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  stat: {
    alignItems: 'center',
    minWidth: 80,
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
  membersList: {
    marginTop: 10,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  memberUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  creatorText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  youBadge: {
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  youText: {
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  emptyMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  expensesList: {
    marginTop: 10,
  },
  expenseItem: {
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  expenseInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(24,140,101,1)',
  },
  expenseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  expensePaidBy: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 10,
  },
  expenseSplit: {
    fontSize: 13,
    color: '#188C65',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 10,
  },
  expenseDate: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10,
  },
  viewAllText: {
    fontSize: 16,
    color: '#188C65',
    fontWeight: '500',
    marginRight: 4,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptySectionText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySectionHint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
  },
  actionButton: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    backgroundColor: 'rgba(24,140,101,0.1)',
    minWidth: 80,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },
  secondaryAction: {
    backgroundColor: '#F5F5F5',
  },
  secondaryActionText: {
    color: '#666',
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  fullyPaidExpenseItem: {
    backgroundColor: 'rgba(24,140,101,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(24,140,101,0.2)',
  },

  fullyPaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginLeft: 10,
  },

  fullyPaidBadgeText: {
    fontSize: 12,
    color: '#188C65',
    fontWeight: '500',
  },

  fullyPaidText: {
    textDecorationLine: 'line-through',
    color: '#666',
  },

  fullyPaidAmount: {
    color: '#188C65',
    textDecorationLine: 'line-through',
  },

  fullyPaidDetail: {
    color: '#666',
    fontStyle: 'italic',
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
    marginLeft: 10,
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

  userBalanceAvatar: {
    backgroundColor: 'rgba(24,140,101,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(24,140,101,0.5)',
  },

  positiveBalanceAvatar: {
    backgroundColor: 'rgba(24,140,101,0.15)',
  },

  negativeBalanceAvatar: {
    backgroundColor: 'rgba(255,149,0,0.1)',
  },

  balanceAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },

  userBalanceAvatarText: {
    color: 'rgba(24,140,101,0.8)',
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

  positiveStatus: {
    color: '#188C65',
  },

  negativeStatus: {
    color: '#FF9500',
  },

  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
  },

  positiveAmount: {
    color: '#188C65',
  },

  negativeAmount: {
    color: '#FF9500',
  },

  zeroAmount: {
    color: '#666',
    fontStyle: 'italic',
  },

  emptyBalances: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },

  debtSummary: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },

  debtSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },

  debtText: {
    fontSize: 14,
    color: '#666',
  },


allPaidSection: {
  backgroundColor: 'rgba(24,140,101,0.05)',
  marginTop: 15,
  padding: 20,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: 'rgba(24,140,101,0.2)',
  alignItems: 'center',
},


allPaidSubtext: {
  fontSize: 14,
  color: '#666',
  textAlign: 'center',
  marginBottom: 15,
},

allPaidGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: 15,
  marginTop: 10,
},

allPaidItem: {
  alignItems: 'center',
  minWidth: 100,
},

creditorAvatar: {
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: 'rgba(24,140,101,0.1)',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 5,
  borderWidth: 2,
  borderColor: 'rgba(24,140,101,0.3)',
},

creditorAvatarText: {
  fontSize: 16,
  fontWeight: 'bold',
  color: 'rgba(24,140,101,1)',
},

creditorStatus: {
  fontSize: 12,
  color: '#188C65',
  fontWeight: '500',
  marginBottom: 2,
},

debtorStatus: {
  fontSize: 12,
  color: '#FF9500',
  fontWeight: '500',
  marginBottom: 2,
},

creditorName: {
  fontSize: 13,
  color: '#333',
  fontWeight: '500',
  textAlign: 'center',
},

creditorAmount: {
  fontSize: 14,
  fontWeight: '700',
  color: '#188C65',
},

debtsList: {
  marginTop: 10,
},

// Se hai bisogno anche di questi per la sezione bilancio
balanceSummary: {
  backgroundColor: '#FFFFFF',
  marginTop: 15,
  padding: 20,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E8E8E8',
},

balanceSummaryTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#333',
  marginBottom: 15,
  textAlign: 'center',
},

balanceSummaryItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F0F0',
},

balanceSummaryLabel: {
  fontSize: 16,
  color: '#666',
  flex: 1,
},

balanceSummaryValue: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
},

balanceSummaryPositive: {
  color: '#188C65',
},

balanceSummaryNegative: {
  color: '#FF9500',
},

balanceSummaryZero: {
  color: '#666',
  fontStyle: 'italic',
},

debtsBreakdown: {
  backgroundColor: '#FFFFFF',
  marginTop: 15,
  padding: 20,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E8E8E8',
},

debtsTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#333',
  marginBottom: 15,
  textAlign: 'center',
},

debtItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 5,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F0F0',
},

debtLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},

debtAvatar: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},

debtAvatarText: {
  fontSize: 13,
  fontWeight: 'bold',
},

debtInfo: {
  flex: 1,
},

debtRelationship: {
  fontSize: 14,
  color: '#333',
  fontWeight: '500',
},

debtAmount: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FF9500',
},

debtArrow: {
  marginHorizontal: 10,
  color: '#999',
},

debtsEmpty: {
  alignItems: 'center',
  paddingVertical: 30,
},

debtsEmptyText: {
  fontSize: 16,
  color: '#999',
  marginTop: 10,
  marginBottom: 5,
},

debtsEmptyHint: {
  fontSize: 14,
  color: '#999',
  fontStyle: 'italic',
  textAlign: 'center',
},

debtRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 12,
  paddingHorizontal: 15,
  backgroundColor: '#FFFFFF',
  borderRadius: 10,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: '#E8E8E8',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},

debtFromTo: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
debtFromAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(255,149,0,0.1)',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 10,
},

debtFromAvatarText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#FF9500',
},

debtFromName: {
  fontSize: 15,
  fontWeight: '500',
  color: '#333',
  flex: 1,
},

debtToName: {
  fontSize: 15,
  fontWeight: '500',
  color: '#333',
  flex: 1,
  textAlign: 'right',
},

debtSource: {
  fontSize: 12,
  color: '#666',
  fontStyle: 'italic',
  marginTop: 4,
},
debtToAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(24,140,101,0.1)',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 10,
},

debtToAvatarText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: 'rgba(24,140,101,1)',
},
// Sostituisci la vecchia sezione "Bilanci del Gruppo" con questi stili:

noDebtsContainer: {
  alignItems: 'center',
  paddingVertical: 30,
},

noDebtsText: {
  fontSize: 16,
  color: '#999',
  marginTop: 10,
},

allPaidContainer: {
  alignItems: 'center',
  paddingVertical: 20,
},

allPaidTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: '#188C65',
  marginTop: 10,
  marginBottom: 5,
},

allPaidText: {
  fontSize: 14,
  color: '#666',
  textAlign: 'center',
  marginBottom: 20,
},

statsRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 30,
  marginTop: 10,
},

statBox: {
  alignItems: 'center',
},

statNumber: {
  fontSize: 20,
  fontWeight: '700',
  color: '#333',
},

statLabel: {
  fontSize: 12,
  color: '#999',
  marginTop: 2,
},

debtsSummary: {
  marginBottom: 20,
},

totalDebtBox: {
  backgroundColor: 'rgba(255,149,0,0.05)',
  borderRadius: 12,
  padding: 20,
  borderWidth: 1,
  borderColor: 'rgba(255,149,0,0.2)',
  marginBottom: 15,
},

totalDebtLabel: {
  fontSize: 14,
  color: '#FF9500',
  fontWeight: '500',
  marginBottom: 5,
},

totalDebtAmount: {
  fontSize: 32,
  fontWeight: '800',
  color: '#FF9500',
  marginBottom: 15,
},

progressContainer: {
  marginTop: 10,
},

progressBackground: {
  height: 8,
  backgroundColor: 'rgba(255,149,0,0.2)',
  borderRadius: 4,
  overflow: 'hidden',
  marginBottom: 5,
},

progressFill: {
  height: '100%',
  backgroundColor: '#188C65',
  borderRadius: 4,
},

progressText: {
  fontSize: 12,
  color: '#666',
  textAlign: 'right',
},

debtsStats: {
  flexDirection: 'row',
  justifyContent: 'space-around',
},

debtStat: {
  alignItems: 'center',
  minWidth: 80,
},

debtStatNumber: {
  fontSize: 18,
  fontWeight: '700',
  color: '#333',
  marginTop: 5,
  marginBottom: 2,
},

debtStatLabel: {
  fontSize: 12,
  color: '#999',
  textAlign: 'center',
},

topDebtorsSection: {
  marginTop: 20,
  marginBottom: 20,
},

topDebtorsTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#333',
  marginBottom: 10,
},

topDebtorsList: {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E8E8E8',
  overflow: 'hidden',
},

debtorItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 12,
  paddingHorizontal: 15,
  borderBottomWidth: 1,
  borderBottomColor: '#F0F0F0',
},

debtorLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},

debtorRank: {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: '#F5F5F5',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 10,
},

firstRank: {
  backgroundColor: '#FFD700',
},

secondRank: {
  backgroundColor: '#C0C0C0',
},

thirdRank: {
  backgroundColor: '#CD7F32',
},

debtorRankText: {
  fontSize: 12,
  fontWeight: 'bold',
  color: '#333',
},

debtorAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(255,149,0,0.1)',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},

debtorAvatarText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#FF9500',
},

debtorInfo: {
  flex: 1,
},

debtorName: {
  fontSize: 16,
  fontWeight: '500',
  color: '#333',
},

youIndicator: {
  fontSize: 14,
  color: '#666',
  fontStyle: 'italic',
},

debtorUsername: {
  fontSize: 13,
  color: '#666',
  marginTop: 2,
},

debtorAmount: {
  fontSize: 16,
  fontWeight: '700',
  color: '#FF9500',
},

settleButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#188C65',
  paddingVertical: 14,
  borderRadius: 12,
  gap: 10,
  marginTop: 10,
  marginBottom: 10,
},

settleButtonText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FFFFFF',
},

hintText: {
  fontSize: 12,
  color: '#999',
  fontStyle: 'italic',
  textAlign: 'center',
  marginTop: 10,
},
memberAvatarImage: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#f0f0f0',
  marginRight: 12,
  borderWidth: 1,
  borderColor: '#E0E0E0',
},
debtorAvatarImage: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(255,149,0,0.1)',
  marginRight: 12,
  borderWidth: 1,
  borderColor: 'rgba(255,149,0,0.2)',
},
});