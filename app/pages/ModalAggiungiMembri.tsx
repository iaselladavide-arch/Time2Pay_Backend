import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = 'http://10.178.160.160:3000';

interface User {
  _id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  fullName?: string;
}

interface ModalAggiungiMembriProps {
  visible: boolean;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  onClose: () => void;
  groupId: string;
  groupName: string;
  currentMembers: User[];
  onMembersAdded: () => void;
}

export default function ModalAggiungiMembri({
  visible,
  fadeAnim,
  slideAnim,
  onClose,
  groupId,
  groupName,
  currentMembers,
  onMembersAdded,
}: ModalAggiungiMembriProps) {
  const [ricercaMembro, setRicercaMembro] = useState('');
  const [membriSelezionati, setMembriSelezionati] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [utentiTrovati, setUtentiTrovati] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Carica l'ID utente
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

    if (visible) {
      loadUserId();
      resetForm();
    }
  }, [visible]);

  // Funzione per cercare utenti dal backend
  const cercaUtenti = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2 || !userId) {
      setUtentiTrovati([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await response.json();
      
      if (data.success) {
        // Filtra gli utenti che sono già membri del gruppo
        const currentMemberIds = currentMembers.map(m => m._id);
        const filteredUsers = data.users.filter((user: User) => 
          !currentMemberIds.includes(user._id)
        );
        setUtentiTrovati(filteredUsers);
      } else {
        setUtentiTrovati([]);
      }
    } catch (error) {
      console.error('Errore ricerca utenti:', error);
      setUtentiTrovati([]);
    } finally {
      setIsSearching(false);
    }
  }, [userId, currentMembers]);

  // Gestione ricerca con debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (ricercaMembro.trim().length >= 2) {
      const timeout = setTimeout(() => {
        cercaUtenti(ricercaMembro);
      }, 300);

      setSearchTimeout(timeout);
    } else { 
      setUtentiTrovati([]);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [ricercaMembro, cercaUtenti]);

  // Aggiungi un membro alla lista selezionati
  const aggiungiMembro = (user: User) => {
    if (!membriSelezionati.some(m => m._id === user._id)) {
      setMembriSelezionati([...membriSelezionati, user]);
    }
    setRicercaMembro('');
    setUtentiTrovati([]);
  };

  // Rimuovi un membro dalla lista selezionati
  const rimuoviMembro = (userId: string) => {
    setMembriSelezionati(membriSelezionati.filter(m => m._id !== userId));
  };

  // Verifica se un membro è già stato selezionato
  const isMembroSelezionato = (userId: string) => {
    return membriSelezionati.some(m => m._id === userId);
  };

  // Invia la richiesta per aggiungere membri
  const aggiungiMembriAlGruppo = async () => {
    if (membriSelezionati.length === 0) {
      Alert.alert('Errore', 'Seleziona almeno un membro da aggiungere');
      return;
    }

    if (!userId) {
      Alert.alert('Errore', 'Devi effettuare il login');
      return;
    }

    setIsLoading(true);

    try {
      // Estrai solo gli username dai membri selezionati
      const memberUsernames = membriSelezionati.map(m => m.username);

      const response = await fetch(`${API_URL}/api/groups/${groupId}/add-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          members: memberUsernames,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore aggiunta membri');
      }

      Alert.alert(
        'Successo!',
        data.message,
        [{
          text: 'OK',
          onPress: () => {
            resetForm();
            onClose();
            onMembersAdded();
          }
        }]
      );

    } catch (error: any) {
      console.error('Errore aggiunta membri:', error);
      
      let errorMessage = 'Impossibile aggiungere i membri. Riprova.';
      
      if (error.message.includes('Utenti non trovati')) {
        errorMessage = error.message;
      } else if (error.message.includes('già membri')) {
        errorMessage = error.message;
      }
      
      Alert.alert('Errore', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setRicercaMembro('');
    setMembriSelezionati([]);
    setUtentiTrovati([]);
  };

  // Gestisci chiusura con reset
  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View style={[styles.overlayBackground, { opacity: fadeAnim }]} />
        </TouchableOpacity>

        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Aggiungi membri</Text>
            <Text style={styles.subtitle}>{groupName}</Text>
            
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <IconSymbol name="xmark" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Ricerca Membri */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cerca membri da aggiungere</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="magnifyingglass" size={20} color="#188C65" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={ricercaMembro}
                  onChangeText={setRicercaMembro}
                  placeholder="Cerca per username, nome o cognome"
                  placeholderTextColor="#999"
                  editable={!isLoading}
                />
                {isSearching && (
                  <ActivityIndicator size="small" color="#188C65" style={styles.searchIndicator} />
                )}
              </View>
              <Text style={styles.hintText}>
                Digita almeno 2 caratteri per cercare
              </Text>
            </View>

            {/* Risultati Ricerca */}
            {ricercaMembro.length >= 2 && (
              <View style={styles.resultsContainer}>
                <ScrollView 
                  style={styles.resultsScroll} 
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {isSearching ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#188C65" />
                      <Text style={styles.loadingText}>Ricerca in corso...</Text>
                    </View>
                  ) : utentiTrovati.length > 0 ? (
                    utentiTrovati.map((utente) => {
                      const selezionato = isMembroSelezionato(utente._id);
                      return (
                        <TouchableOpacity
                          key={utente._id}
                          style={[
                            styles.resultItem,
                            selezionato && styles.resultItemSelected
                          ]}
                          onPress={() => selezionato ? rimuoviMembro(utente._id) : aggiungiMembro(utente)}
                          disabled={isLoading}
                        >
                          <View style={styles.resultInfo}>
                            <Text style={styles.resultName}>
                              {utente.name} {utente.surname}
                            </Text>
                            <Text style={styles.resultUsername}>@{utente.username}</Text>
                          </View>
                          {selezionato ? (
                            <IconSymbol name="checkmark.circle.fill" color="#188C65" size={24} />
                          ) : (
                            <IconSymbol name="plus.circle" color="#666" size={24} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.noResults}>
                      <IconSymbol name="person.slash" size={24} color="#999" />
                      <Text style={styles.noResultsText}>
                        Nessun utente trovato
                      </Text>
                      <Text style={styles.noResultsHint}>
                        Prova con un username diverso
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Membri Selezionati */}
            {membriSelezionati.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Membri da aggiungere ({membriSelezionati.length})
                </Text>
                <View style={styles.selectedMembersContainer}>
                  {membriSelezionati.map((membro) => (
                    <View key={membro._id} style={styles.selectedMember}>
                      <View style={styles.memberInfo}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {membro.name?.charAt(0)}{membro.surname?.charAt(0)}
                          </Text>
                        </View>
                        <View style={styles.memberTextContainer}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {membro.name} {membro.surname}
                          </Text>
                          <Text style={styles.memberUsername} numberOfLines={1}>
                            @{membro.username}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        onPress={() => rimuoviMembro(membro._id)}
                        disabled={isLoading}
                        style={styles.removeButton}
                      >
                        <IconSymbol name="x.circle" color="#FF3B30" size={24} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Spazio per il fade gradient */}
            <View style={styles.spacer} />
          </ScrollView>

          {/* Fade gradient per lo scroll */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
            style={styles.fadeBottom}
          />

          {/* Bottone Aggiungi */}
          <View style={styles.footer}>
            <TouchableOpacity 
              onPress={aggiungiMembriAlGruppo} 
              style={[
                styles.addButton,
                (membriSelezionati.length === 0 || isLoading) && styles.addButtonDisabled
              ]}
              disabled={membriSelezionati.length === 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.addButtonText, styles.addButtonTextLoading]}>
                    Aggiungendo...
                  </Text>
                </>
              ) : (
                <>
                  <IconSymbol name="person.badge.plus" size={22} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>
                    Aggiungi {membriSelezionati.length} membro{membriSelezionati.length !== 1 ? 'i' : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 50,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 30,
    paddingBottom: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  title: {
    color: 'rgba(24,140,101,1)',
    fontSize: 26,
    fontWeight: '500',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 30,
    padding: 5,
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 100,
  },
  inputGroup: {
    marginHorizontal: 20,
    marginTop: 25,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  searchIndicator: {
    marginLeft: 10,
  },
  resultsContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    maxHeight: 200,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  resultsScroll: {
    padding: 10,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  resultItemSelected: {
    backgroundColor: 'rgba(24,140,101,0.1)',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  resultUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  noResults: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  noResultsHint: {
    marginTop: 5,
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
  },
  selectedMembersContainer: {
    marginTop: 10,
  },
  selectedMember: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#188C65',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  memberTextContainer: {
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
  removeButton: {
    padding: 4,
  },
  spacer: {
    height: 100,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    height: 50,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
  },
  addButtonDisabled: {
    backgroundColor: 'rgba(24,140,101,0.5)',
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextLoading: {
    marginLeft: 10,
  },
});