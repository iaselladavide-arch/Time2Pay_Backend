import React, { useState, useEffect, useCallback } from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Animated, 
  Modal, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  TouchableWithoutFeedback, 
  View, 
  Alert,
  ActivityIndicator 
} from "react-native";

type Props = {
  visible: boolean;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  onClose: () => void;
  onGroupCreated?: () => void;
};

// URL del backend - modifica con il tuo IP
const API_URL = 'http://10.178.160.160:3000';

interface User {
  _id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  fullName?: string;
}

export default function ModalNuovoGruppo({ visible, fadeAnim, slideAnim, onClose, onGroupCreated }: Props) {
  const [nomeGruppo, setNomeGruppo] = useState('');
  const [ricercaMembro, setRicercaMembro] = useState('');
  const [membriSelezionati, setMembriSelezionati] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [utentiTrovati, setUtentiTrovati] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Carica l'ID utente all'apertura del modal
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
        setUtentiTrovati(data.users);
      } else {
        console.error('Errore ricerca utenti:', data.error);
        setUtentiTrovati([]);
      }
    } catch (error) {
      console.error('Errore chiamata API:', error);
      setUtentiTrovati([]); 
    } finally {
      setIsSearching(false);
    }
  }, [userId]);

  // Gestione ricerca con debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (ricercaMembro.trim().length >= 2) {
      const timeout = setTimeout(() => {
        cercaUtenti(ricercaMembro);
      }, 300); // Debounce di 300ms

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

  // Crea il gruppo
  const creaGruppo = async () => {
    // Validazioni
    if (!nomeGruppo.trim()) {
      Alert.alert('Errore', 'Inserisci un nome per il gruppo');
      return;
    }

    if (nomeGruppo.trim().length < 3) {
      Alert.alert('Errore', 'Il nome del gruppo deve avere almeno 3 caratteri');
      return;
    }

    if (!userId) {
      Alert.alert('Errore', 'Devi effettuare il login per creare un gruppo');
      return;
    }

    setIsCreating(true);

    try {
      // Estrai solo gli username dai membri selezionati
      const memberUsernames = membriSelezionati.map(m => m.username);

      const response = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          name: nomeGruppo.trim(),
          members: memberUsernames,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Errore creazione gruppo');
      }

      Alert.alert(
        'Successo!',
        `Gruppo "${nomeGruppo}" creato con successo!`,
        [{
          text: 'OK',
          onPress: () => {
            resetForm();
            onClose();
            if (onGroupCreated) {
              onGroupCreated();
            }
          }
        }]
      );

    } catch (error: any) {
      console.error('Errore creazione gruppo:', error);
      
      let errorMessage = 'Impossibile creare il gruppo. Riprova.';
      
      if (error.message.includes('Utenti non trovati')) {
        errorMessage = error.message;
      } else if (error.message.includes('network')) {
        errorMessage = 'Errore di connessione. Verifica la rete.';
      }
      
      Alert.alert('Errore', errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setNomeGruppo('');
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
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.sfondoChiusura, {opacity: fadeAnim}]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.visibile, {transform: [{translateY: slideAnim}]}]}>
          <View style={styles.title}>
            <Text style={styles.titleText}>Nuovo gruppo</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <IconSymbol name="chevron.down" color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContainer}
          >
            {/* Nome Gruppo */}
            <View style={styles.campo}>
              <Text style={styles.titleCampo}>Nome gruppo *</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="person.2" size={20} color="#188C65" style={styles.inputIcon} />
                <TextInput
                  style={styles.testoCampo}
                  value={nomeGruppo}
                  onChangeText={setNomeGruppo}
                  placeholder="Es. Weekend a Roma"
                  placeholderTextColor="#999"
                  maxLength={50}
                  editable={!isCreating}
                />
              </View>
              <Text style={styles.charCounter}>
                {nomeGruppo.length}/50 caratteri
              </Text>
            </View>

            {/* Ricerca Membri */}
            <View style={styles.campo}>
              <Text style={styles.titleCampo}>Aggiungi membri</Text>
              <View style={styles.inputContainer}>
                <IconSymbol name="magnifyingglass" size={20} color="#188C65" style={styles.inputIcon} />
                <TextInput
                  style={styles.testoCampo}
                  value={ricercaMembro}
                  onChangeText={setRicercaMembro}
                  placeholder="Cerca per username, nome o cognome"
                  placeholderTextColor="#999"
                  editable={!isCreating}
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
              <View style={styles.risultatiContainer}>
                <ScrollView 
                  style={styles.risultatiScroll} 
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {isSearching ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#188C65" />
                      <Text style={styles.loadingText}>Ricerca in corso...</Text>
                    </View>
                  ) : utentiTrovati.length > 0 ? (
                    utentiTrovati.map((utente, i) => {
                      const selezionato = isMembroSelezionato(utente._id);
                      return (
                        <TouchableOpacity
                          key={utente._id}
                          style={[
                            styles.risultatoItem,
                            selezionato && styles.risultatoItemSelezionato
                          ]}
                          onPress={() => selezionato ? rimuoviMembro(utente._id) : aggiungiMembro(utente)}
                          disabled={isCreating}
                        >
                          <View style={styles.risultatoInfo}>
                            <Text style={styles.risultatoNome}>
                              {utente.name} {utente.surname}
                            </Text>
                            <Text style={styles.risultatoUsername}>@{utente.username}</Text>
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
              <View style={styles.campo}>
                <Text style={styles.titleCampo}>
                  Membri selezionati ({membriSelezionati.length})
                </Text>
                <View style={styles.membriSelezionatiContainer}>
                  {membriSelezionati.map((membro) => (
                    <View key={membro._id} style={styles.membroSelezionato}>
                      <View style={styles.membroInfo}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {membro.name?.charAt(0)}{membro.surname?.charAt(0)}
                          </Text>
                        </View>
                        <View style={styles.membroTextContainer}>
                          <Text style={styles.membroNome} numberOfLines={1}>
                            {membro.name} {membro.surname}
                          </Text>
                          <Text style={styles.membroUsername} numberOfLines={1}>
                            @{membro.username}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        onPress={() => rimuoviMembro(membro._id)}
                        disabled={isCreating}
                        style={styles.removeButton}
                      >
                        <IconSymbol name="x.circle" color="#FF3B30" size={24} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Nota informativa */}
            <View style={styles.infoBox}>
              <IconSymbol name="info.circle" size={18} color="#666" />
              <Text style={styles.infoText}>
                Sarai aggiunto automaticamente come membro del gruppo
              </Text>
            </View>

            {/* Spazio per il fade gradient */}
            <View style={styles.spazioFade} />
          </ScrollView>

          {/* Fade gradient per lo scroll */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
            style={styles.fadeBottom}
          />

          {/* Bottone Crea */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              onPress={creaGruppo} 
              style={[
                styles.buttonCrea,
                (!nomeGruppo.trim() || isCreating) && styles.buttonCreaDisabled
              ]}
              disabled={!nomeGruppo.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.buttonText, styles.buttonTextLoading]}>
                    Creando...
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    Crea Gruppo
                  </Text>
                  <IconSymbol name="checkmark" color="#fff" size={20} style={styles.buttonIcon} />
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
  sfondoChiusura: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  visibile: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0, top: 50,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  title: {
    paddingTop: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 15,
  },
  titleText: {
    color: 'rgba(24,140,101,1)',
    fontSize: 26,
    fontWeight: '500',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 30,
    padding: 5,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 120,
  },
  campo: {
    marginHorizontal: 20,
    marginTop: 25,
  },
  titleCampo: {
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
  testoCampo: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  charCounter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 5,
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
  risultatiContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    maxHeight: 200,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  risultatiScroll: {
    padding: 10,
  },
  risultatoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  risultatoItemSelezionato: {
    backgroundColor: 'rgba(24,140,101,0.1)',
  },
  risultatoInfo: {
    flex: 1,
  },
  risultatoNome: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  risultatoUsername: {
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
  membriSelezionatiContainer: {
    marginTop: 10,
  },
  membroSelezionato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  membroInfo: {
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
  membroTextContainer: {
    flex: 1,
  },
  membroNome: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  membroUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f5',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#188C65',
    fontStyle: 'italic',
  },
  spazioFade: {
    height: 100,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    height: 50,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  buttonCrea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonCreaDisabled: {
    backgroundColor: 'rgba(24,140,101,0.5)',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  buttonTextLoading: {
    marginLeft: 10,
  },
  buttonIcon: {
    marginLeft: 5,
  },
});