import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Dimensions, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '../../components/ui/icon-symbol';

const { width, height } = Dimensions.get('window');

interface ProfileLoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function ProfileLogin({ onLoginSuccess }: ProfileLoginProps) {
  const router = useRouter();
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await fetch('http://192.168.1.13:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        Alert.alert('Login riuscito', 'Benvenuto!');
        onLoginSuccess(data.user);
      } else {
        Alert.alert('Login fallito', data.error || 'Email o password non validi');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Errore', err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accedi</Text>

      {!showEmailLogin && (
        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.button}>
            <Image source={require('@/assets/images/apple.png')} style={{ width: 18, height: 20 }} />
            <Text style={styles.buttonText}>Accedi con Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button}>
            <Image source={require('@/assets/images/google.png')} style={{ width: 20, height: 18 }} />
            <Text style={styles.buttonText}>Accedi con Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button}>
            <Image source={require('@/assets/images/facebook.png')} style={{ width: 18, height: 20 }} />
            <Text style={styles.buttonText}>Accedi con Facebook</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => setShowEmailLogin(true)}>
            <IconSymbol name="envelope" color="black" size={22} />
            <Text style={styles.buttonText}>Accedi con la tua email</Text>
          </TouchableOpacity>
        </View>
      )}

      {showEmailLogin && (
        <View style={styles.emailForm}>
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
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Accedi</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/pages/profileRegister')} style={{ marginTop: 10 }}>
            <Text style={styles.registerText}>Non hai un account? Registrati</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: width * 0.1, paddingTop: height * 0.2, backgroundColor: 'white' },
  title: { fontSize: 25, fontWeight: '500', marginBottom: 20, textAlign: 'center' },
  socialButtons: { marginTop: 20 },
  button: {
    flexDirection: 'row',
    backgroundColor: '#e2e2e2',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontSize: 18, fontWeight: '500', marginLeft: 5 },
  emailForm: { marginTop: 20 },
  input: { borderWidth: 1, borderColor: '#c8c8c8', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10, marginBottom: 15 },
  loginButton: { backgroundColor: '#188c65', paddingVertical: 15, borderRadius: 10 },
  loginButtonText: { color: 'white', fontSize: 18, textAlign: 'center', fontWeight: '500' },
  registerText: { color: '#188c65', textAlign: 'center', fontSize: 16 },
});
