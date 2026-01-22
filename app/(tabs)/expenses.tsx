// expenses.tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ExpensesProps {
  active: boolean; // <--- qui dichiariamo la prop
}

interface User {
  _id: string;
  username: string;
  name?: string;
}

interface Expense {
  _id: string;
  description: string;
  amount: number;
  paidBy: User;
}

export default function ExpensesPage({ active }: ExpensesProps) { // <--- accettiamo la prop
  const [userId, setUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const stored = await AsyncStorage.getItem('userData');

    if (!stored) {
      setUserId(null);
      setExpenses([]);
      setLoading(false);
      return;
    }

    const user = JSON.parse(stored);
    setUserId(user._id);

    try {
      const res = await fetch(`http://10.178.160.160:3000/api/expenses/user/${user._id}`, {
        headers: { 'x-user-id': user._id },
      });
      const data = await res.json();
      setExpenses(data.success ? data.expenses || [] : []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🔹 Effetto che si attiva solo quando la tab è visibile
  useEffect(() => {
    if (active) {
      loadData();
    }
  }, [active]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#188C65" />
      <Text>Caricamento spese...</Text>
    </View>
  );

  if (!userId) return (
    <View style={styles.centered}>
      <Text>Devi loggare per vedere le spese</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#188C65']} />
      }
    >
      {expenses.map(e => (
        <View key={e._id} style={styles.expenseCard}>
          <Text style={{ fontWeight: 'bold' }}>{e.description}</Text>
          <Text>{e.amount.toFixed(2)} €</Text>
          <Text>Pagata da: {e.paidBy.name || e.paidBy.username}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  expenseCard: { padding: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12 },
});
