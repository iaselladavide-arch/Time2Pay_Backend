import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useNavigation } from 'expo-router';
import { 
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';


const API_URL = 'http://10.178.160.160:3000';

interface GroupMember {
  _id: string;
  username: string;
  name: string;
}

interface HomeProps {
  active: boolean; // aggiungi questa prop
}

interface Group {
  _id: string;
  name: string;
  description: string;
  createdBy: GroupMember;
  members: GroupMember[];
  totalExpenses: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  image?: string;
}

export default function HomeScreen({ active }: HomeProps) {
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigation = useNavigation();

  // ---------- Carica userId solo una volta ----------
  useEffect(() => {
  const loadUserId = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) setUserId(JSON.parse(userData)._id);
      else setUserId(null);
    } catch {
      setUserId(null);
    } finally {
      setLoading(false); // <-- fondamentale! anche se userId è null
    }
  };
  loadUserId();
}, []);

  // ---------- Carica gruppi SOLO quando la tab diventa attiva ----------
  useEffect(() => {
  if (active && userId) {
    setLoading(true); // qui sì, caricamento dei gruppi
    loadRecentGroups();
  }
}, [active, userId]);

const refreshUserId = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) setUserId(JSON.parse(userData)._id);
    else setUserId(null); // <- fondamentale per logout
  } catch {
    setUserId(null);
  }
};

useEffect(() => {
  if (active) {
    refreshUserId(); // aggiorna sempre userId quando torno sulla tab
  }
}, [active]);

  // ---------- Funzioni principali ----------
  const loadRecentGroups = async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/groups/my-groups`, {
        method: 'GET',
        headers: { 'x-user-id': userId },
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Risposta non valida'); }

      if (data.success && data.groups) {
        const sorted = (data.groups as Group[])
          .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
          .slice(0, 3);
        setRecentGroups(sorted);
      } else {
        await tryAlternativeEndpoint();
      }
    } catch (error) {
      console.error('Errore loadRecentGroups:', error);
      await tryAlternativeEndpoint();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const tryAlternativeEndpoint = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_URL}/api/groups/user/${userId}`, {
        method: 'GET',
        headers: { 'x-user-id': userId },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.groups) {
          const sorted = (data.groups as Group[])
            .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
            .slice(0, 3);
          setRecentGroups(sorted);
          return;
        }
      }
    } catch (error) {
      console.error('Endpoint alternativo fallito:', error);
    }

    Alert.alert(
      'Info',
      'Non hai ancora creato o partecipato a nessun gruppo. Crea il tuo primo gruppo per iniziare!',
      [{ text: 'OK' }]
    );
    setRecentGroups([]);
  };

  const onRefresh = () => {
    if (!userId) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    loadRecentGroups();
  };

  const handleGroupPress = (group: Group) => {
    router.push({
      pathname: '/pages/singleGroup',
      params: {
        groupId: group._id,
        groupName: group.name,
        createdBy: JSON.stringify(group.createdBy),
        members: JSON.stringify(group.members),
        memberCount: group.memberCount.toString(),
        totalExpenses: group.totalExpenses.toString(),
        createdAt: group.createdAt,
      },
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Oggi';
      if (diffDays === 1) return 'Ieri';
      if (diffDays < 7) return `${diffDays} giorni fa`;
      return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    } catch {
      return 'Data non disponibile';
    }
  };

  // ---------- Render ----------
  if (loading) {
    return (
      <>
        <View style={styles.title}>
          <Image source={require('@/assets/images/logo-app.png')} style={styles.titleImage} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#188C65" />
          <Text style={styles.loadingText}>Caricamento gruppi...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={styles.title}>
        <Image source={require('@/assets/images/logo-app.png')} style={styles.titleImage} />
      </View>

      <ScrollView
        style={styles.page}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#188C65']}
            tintColor="#188C65"
          />
        }
      >
        <View style={styles.expenses}>
          <Text style={styles.titlePage}>
            {recentGroups.length > 0 ? 'Gruppi Recenti' : 'I Tuoi Gruppi'}
          </Text>

          {recentGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="person.2" size={50} color="#CCCCCC" />
              <Text style={styles.emptyStateTitle}>Nessun gruppo ancora</Text>
              <Text style={styles.emptyStateText}>
                {userId
                  ? 'Crea il tuo primo gruppo per iniziare a dividere le spese!'
                  : 'Effettua il login per vedere i tuoi gruppi'}
              </Text>

              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => userId? router.push('/pages/gruppi'): undefined}
              >
                <IconSymbol name={userId ? 'plus' : 'person.fill'} size={20} color="#FFFFFF" />
                <Text style={styles.emptyStateButtonText}>
                  {userId ? 'Crea un gruppo' : 'Effettua il login'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {recentGroups.map((group) => (
                <TouchableOpacity
                  key={group._id}
                  style={styles.groupCard}
                  onPress={() => handleGroupPress(group)}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupHeader}>
                    {group.image ? (
                      <Image source={{ uri: group.image }} style={styles.groupImage} />
                    ) : (
                      <View style={styles.groupAvatar}>
                        <Text style={styles.avatarText}>{group.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                      <Text style={styles.groupCreator} numberOfLines={1}>
                        Creato da {group.createdBy?.name || 'Utente'}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={20} color="#666" />
                  </View>

                  <View style={styles.groupDetails}>
                    <View style={styles.detailRow}>
                      <IconSymbol name="person.2" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {group.memberCount || group.members?.length || 0} membro{group.memberCount !== 1 ? 'i' : ''}
                      </Text>
                    </View>

                    {group.totalExpenses > 0 && (
                      <View style={styles.detailRow}>
                        <IconSymbol name="tag" size={16} color="#666" />
                        <Text style={styles.detailText}>{group.totalExpenses.toFixed(2)} € totali</Text>
                      </View>
                    )}

                    <View style={styles.lastUpdated}>
                      <IconSymbol name="clock" size={14} color="#999" />
                      <Text style={styles.lastUpdatedText}>{formatDate(group.updatedAt || group.createdAt)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.groups}>
          <Text style={styles.titlePage}>Gestisci Gruppi</Text>
          <View style={{ flexDirection: 'column', gap: 30 }}>
            <TouchableOpacity style={styles.dettagli} onPress={() => router.push('/pages/gruppi')}>
              <Text style={styles.LinkText}>Vedi tutti i gruppi</Text>
              <IconSymbol size={20} name="chevron.right" color="black" style={{ alignSelf: 'center' }} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}


const styles = StyleSheet.create({
  title: {
    paddingTop: 50,
    height: 120,
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  titleImage: {
    width: 150,
    aspectRatio: 2.5,
  },
  page: {
    backgroundColor: 'white',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  expenses: {
    paddingBottom: 20,
  },
  titlePage: {
    marginVertical: 20,
    marginHorizontal: 20,
    fontSize: 20,
    color: 'rgba(24, 140, 101, 1)',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
    backgroundColor: '#F8F8F8',
    marginHorizontal: 20,
    borderRadius: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,140,101,1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  groupsList: {
    paddingHorizontal: 20,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(24,140,101,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(24,140,101,1)',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#333',
    marginBottom: 2,
  },
  groupCreator: { 
    fontSize: 14, 
    color: '#666',
  },
  groupDetails: {
    marginLeft: 52, // Per allineare con l'avatar
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  groups: {
    paddingTop: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#F8F8F8',
  },
  dettagli: {
    borderWidth: 2,
    borderColor: 'rgba(24, 140, 101, 1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginHorizontal: 50,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  LinkText: {
    fontSize: 18,
    fontWeight: '500',
  },
  groupImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    marginRight: 12,
  },
});