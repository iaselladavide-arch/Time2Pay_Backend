import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function ProfileRegister() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');

  const handleRegister = async () => {
    try {
      const res = await fetch('http://192.168.1.13:3000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username, name, surname }),
      });

      const data = await res.json();

      if (data.success) {
        Alert.alert('Registrazione riuscita', 'Benvenuto!');
        router.push('/pages/profileLogin'); // torna al login
      } else {
        Alert.alert('Registrazione fallita', data.error || 'Errore sconosciuto');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Errore', err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Registrati</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput placeholder="Username" style={styles.input} value={username} onChangeText={setUsername} />
      <TextInput placeholder="Nome" style={styles.input} value={name} onChangeText={setName} />
      <TextInput placeholder="Cognome" style={styles.input} value={surname} onChangeText={setSurname} />

      <TouchableOpacity style={styles.buttonSubmit} onPress={handleRegister}>
        <Text style={styles.textSubmit}>Registrati</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/pages/profileLogin')} style={{ marginTop: 10 }}>
        <Text style={styles.loginText}>Hai già un account? Accedi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: width * 0.1,
    paddingTop: height * 0.15,
    backgroundColor: 'white',
  },
  title: { fontSize: 25, fontWeight: '500', marginBottom: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonSubmit: {
    backgroundColor: '#188c65',
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  textSubmit: { color: 'white', fontSize: 18, textAlign: 'center', fontWeight: '500' },
  loginText: { color: '#188c65', textAlign: 'center', fontSize: 16 },
});
