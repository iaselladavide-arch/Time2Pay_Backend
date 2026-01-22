import ModalNuovoGruppo from '@/app/pages/modalNuovoGruppo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert, RefreshControl } from 'react-native';

// URL del backend
const API_URL = 'http://10.178.160.160:3000';

interface GroupMember {
  _id: string;
  username: string;
  name: string;
}

interface Group {
  _id: string;
  name: string;
  description: string;
  image: string | null; // AGGIUNTO: campo per l'immagine
  createdBy: GroupMember;
  members: GroupMember[];
  totalExpenses: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function Gruppi() {
  const [modalVisible, setModalVisible] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userLogged, setUserLogged] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(200)).current;

  // Carica l'ID utente
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user._id);
          setUserLogged(true);
        } else {
          setUserLogged(false);
          setLoading(false); // Ferma il caricamento se non è loggato
        }
      } catch (error) {
        console.error('Errore caricamento userId:', error);
        setUserLogged(false);
        setLoading(false);
      }
    };

    loadUserId();
  }, []);

  // Carica i gruppi quando userId è disponibile
  useEffect(() => {
    if (userId) {
      loadGroups();
    } else if (userLogged === false) {
      // Se sappiamo già che l'utente non è loggato, ferma il loading
      setLoading(false);
    }
  }, [userId, userLogged]);

  const loadGroups = async () => {
    if (!userId) {
      console.log('UserId non disponibile');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${API_URL}/api/groups/my-groups`, {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      });

      const data = await response.json();
      
      console.log('Dati gruppi ricevuti:', data);

      if (data.success) {
        setGroups(data.groups || []);
      } else {
        console.error('Errore caricamento gruppi:', data.error);
        // Non mostrare alert per errori di autenticazione
        if (!data.error.includes('autenticazione') && !data.error.includes('non trovato')) {
          Alert.alert('Errore', data.error || 'Impossibile caricare i gruppi');
        }
      }
    } catch (error) {
      console.error('Errore chiamata API:', error);
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (!userLogged) return;
    setRefreshing(true);
    loadGroups();
  };

  const openModal = () => {
    if (!userLogged) {
      Alert.alert(
        'Accesso richiesto',
        'Devi effettuare il login per creare un gruppo',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Vai al Login', onPress: () => router.push('./profileLogin') }
        ]
      );
      return;
    }
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, bounciness: 5, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 800, duration: 200, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  };

  const handleGroupCreated = () => {
    if (userLogged) {
      loadGroups(); // Ricarica i gruppi dopo la creazione
    }
  };

  // Funzione per ottenere le iniziali del creatore
  const getCreatorInitials = (name: string, surname: string) => {
    return `${name?.charAt(0) || ''}${surname?.charAt(0) || ''}`.toUpperCase();
  };

  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Se l'utente non è loggato
  if (!userLogged && !loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.title}>
            <Text style={styles.titleText}>Gruppi</Text>

            <TouchableOpacity style={styles.backButton} onPress={() => router.push('..')}>
              <IconSymbol name="chevron.left" color="rgb(0,0,0)" />
            </TouchableOpacity>
          </View>

          <View style={styles.notLoggedContainer}>
            <IconSymbol name="person" size={80} color="#188c65" />
            <Text style={styles.notLoggedTitle}>Accesso richiesto</Text>
            <Text style={styles.notLoggedText}>
              Devi effettuare il login per vedere i tuoi gruppi
            </Text>
          </View>
        </View>
      </>
    );
  }

  if (loading && groups.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.title}>
            <Text style={styles.titleText}>Gruppi</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#188C65" />
            <Text style={styles.loadingText}>Caricamento gruppi...</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.title}>
        <Text style={styles.titleText}>I Tuoi Gruppi</Text>

        <TouchableOpacity style={styles.backButton} onPress={() => router.push('..')}>
          <IconSymbol name="chevron.left" color="rgb(0,0,0)" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <IconSymbol name="plus" color="rgb(0,0,0)" />
        </TouchableOpacity>
      </View>

      <View style={styles.page}>
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#188C65']}
              tintColor="#188C65"
              enabled={userLogged} // Disabilita refresh se non loggato
            />
          }
        >
          {groups.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="person.2" size={60} color="#CCCCCC" />
              <Text style={styles.emptyStateTitle}>Nessun gruppo ancora</Text>
              <Text style={styles.emptyStateText}>
                Crea il tuo primo gruppo per iniziare a dividere le spese!
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={openModal}
              >
                <IconSymbol name="plus" size={20} color="#FFFFFF" />
                <Text style={styles.emptyStateButtonText}>Crea il primo gruppo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.groupsCount}>
                {groups.length} gruppo{groups.length !== 1 ? 'i' : ''}
              </Text>
              
              {groups.map((group) => (
                <TouchableOpacity 
                  key={group._id} 
                  style={styles.gruppo}
                  onPress={() => router.push({
                    pathname: '/pages/singleGroup',
                    params: {
                      groupId: group._id,
                      groupName: group.name,
                      groupImage: group.image || '', // AGGIUNTO: passa l'immagine
                      createdBy: JSON.stringify(group.createdBy),
                      members: JSON.stringify(group.members),
                      memberCount: group.memberCount.toString(),
                      totalExpenses: group.totalExpenses.toString(),
                      createdAt: group.createdAt,
                    },
                  })}
                >
                  <View style={styles.gruppoHeader}>
                    {/* MODIFICATO: Mostra immagine o avatar con iniziali */}
                    {group.image ? (
                      <View style={styles.gruppoAvatar}>
                        <Image 
                          source={{ uri: group.image }} 
                          style={styles.gruppoImage}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View style={styles.gruppoAvatar}>
                        <Text style={styles.avatarText}>
                          {group.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.gruppoInfo}>
                      <Text style={styles.nomeGruppo} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={styles.createdByGruppo} numberOfLines={1}>
                        Creato da {group.createdBy?.name || 'Utente'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.gruppoDetails}>
                    <View style={styles.detailRow}>
                      <IconSymbol name="person.2" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {group.memberCount} membro{group.memberCount !== 1 ? 'i' : ''}
                      </Text>
                    </View>
                    
                    {group.totalExpenses > 0 && (
                      <View style={styles.detailRow}>
                        <IconSymbol name="tag" size={16} color="#666" />
                        <Text style={styles.detailText}>
                          {group.totalExpenses.toFixed(2)} € totali
                        </Text>
                      </View>
                    )}
                    
                    <Text style={styles.dateText}>
                      {formatDate(group.createdAt)}
                    </Text>
                  </View>

                  <IconSymbol name="chevron.right" color="#666" />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>

        {groups.length > 0 && (
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={openModal}
          >
            <IconSymbol name="plus" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
          style={styles.fadeBottom}
        />
      </View>

      <ModalNuovoGruppo 
        visible={modalVisible} 
        fadeAnim={fadeAnim} 
        slideAnim={slideAnim} 
        onClose={closeModal}
        onGroupCreated={handleGroupCreated}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  title: {
    height: 120,
    paddingTop: 70,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  backButton: { 
    position: 'absolute', 
    left: 20, 
    top: 70, 
    padding: 10, 
    zIndex: 2 
  },
  addButton: { 
    position: 'absolute', 
    right: 20, 
    top: 70, 
    padding: 10, 
    zIndex: 2 
  },
  titleText: {
    color: 'rgba(24,140,101,1)',
    fontSize: 26,
    fontWeight: '600',
  },
  page: { 
    flex: 1, 
    backgroundColor: '#F8F8F8',
  },
  notLoggedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F8F8F8',
  },
  notLoggedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  notLoggedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  groupsCount: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 30,
    marginTop: 20,
    marginBottom: 10,
  },
  gruppo: {
    marginHorizontal: 20,
    marginVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gruppoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gruppoAvatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden', // Per l'immagine
  },
  // AGGIUNTO: Stile per l'immagine del gruppo
  gruppoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  gruppoInfo: {
    flex: 1,
  },
  nomeGruppo: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333',
    marginBottom: 4,
  },
  createdByGruppo: { 
    fontSize: 14, 
    color: '#666',
  },
  gruppoDetails: {
    flex: 1,
    marginLeft: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#188c65',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
});