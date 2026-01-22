import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userParam = Array.isArray(params.user) ? params.user[0] : params.user;
  const user = userParam ? JSON.parse(userParam) : null;

  const handleLogout = () => {
    router.replace('/pages/profileLogin'); // Torna alla pagina login
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Utente non loggato</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.buttonLogout}>
          <Text style={styles.textButton}>Indietro al login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profilo</Text>
      <Text>Email: {user.email}</Text>
      <Text>Username: {user.username}</Text>
      <Text>Nome: {user.name}</Text>
      <Text>Cognome: {user.surname}</Text>

      <TouchableOpacity onPress={handleLogout} style={styles.buttonLogout}>
        <Text style={styles.textButton}>Esci</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 25, fontWeight: '500', marginBottom: 20 },
  buttonLogout: { marginTop: 30, backgroundColor: 'red', paddingVertical: 12, borderRadius: 10 },
  textButton: { color: 'white', textAlign: 'center', fontWeight: '500', fontSize: 16 },
});
