import { Stack } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Spesa from '@/components/spesa';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Expense } from '../../backend/types/expense';

const API_URL = 'http://10.178.160.160:3000';

interface ExpensesBalanceProps {
  groupId: string;
  groupName: string;
}

export default function ExpensesBalance({ groupId, groupName }: ExpensesBalanceProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
  const fetchUser = async () => {
    const userString = await AsyncStorage.getItem('user');
    console.log('ASYNC USER RAW:', userString); // 👈 QUESTO
    if (userString) {
      const user = JSON.parse(userString);
      console.log('USER PARSED:', user);
      setUserId(user._id);
    }
  };
  fetchUser();
}, []);

  useEffect(() => {
    if (userId) loadExpenses();
  }, [userId]);

  const loadExpenses = async () => {
  setLoading(true);
  try {
    const res = await fetch(`${API_URL}/api/expenses/group/${groupId}`, {
      headers: { 'x-user-id': userId! }
    });

    console.log('FETCH STATUS:', res.status); // 👈
    const data = await res.json();
    console.log('FETCH DATA:', data); // 👈

    if (data.success) {
      setExpenses(data.expenses);
      setFilteredExpenses(data.expenses);
    } else {
      console.warn('SUCCESS FALSE');
    }
  } catch (e) {
    console.error('FETCH ERROR:', e);
  } finally {
    setLoading(false); // 👈 QUESTO DEVE SEMPRE SCATTARE
    setRefreshing(false);
  }
};



  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    let filtered = [...expenses];
    if (text.trim()) {
      filtered = filtered.filter(exp =>
        exp.description.toLowerCase().includes(text.toLowerCase())
      );
    }
    setFilteredExpenses(filtered);
  };

  const totalAmount = filteredExpenses.reduce(
    (sum, exp) => sum + exp.summary.totalAmount,
    0
  );

  if (loading || !userId) {
    return (
      <>
        <Stack.Screen options={{ title: `Spese di ${groupName}` }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#188C65" />
          <Text>Caricamento spese...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Spese di ${groupName}` }} />

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#188C65']} />
        }
      >
        {/* Riepilogo */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            Totale: {totalAmount.toFixed(2)} €
          </Text>
        </View>

        {/* Ricerca */}
        <View style={styles.searchSection}>
          <TextInput
            ref={searchRef}
            placeholder="Cerca..."
            value={searchQuery}
            onChangeText={handleSearch}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <IconSymbol name="xmark.circle" size={24} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {/* Lista spese */}
        <View style={styles.expensesList}>
          {filteredExpenses.map(exp => (
            <Spesa
                key={exp._id}
                done={exp.done ?? false}
                description={exp.description}
                totalAmount={exp.summary.totalAmount}
                splitBetween={exp.splitBetween?.map(m => m.username).join(', ') ?? ''}
                creator={(exp.creator ?? exp.paidBy).username}
                gruppo={exp.gruppo ?? ''}
                data={new Date(exp.createdAt).toLocaleDateString('it-IT')}
                tagName={exp.tagName ?? ''}
                colorTag={exp.tagColor ?? '#ccc'}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12 },
  summaryText: { fontWeight: 'bold', fontSize: 16 },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  searchInput: { flex: 1, height: 40 },
  expensesList: { gap: 8, marginBottom: 20 },
});
