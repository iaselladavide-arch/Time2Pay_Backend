const AsyncStorage = require('@react-native-async-storage/async-storage').default;
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { 
  Dimensions, 
  Image, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'http://10.178.160.160:3000';

interface UserData {
  _id: string;
  email: string;
  username: string;
  name: string;
  surname: string;
  profileImage?: string;
}

export default function Profile() {
  const [screen, setScreen] = useState<'menu' | 'login' | 'register' | 'logged'>('menu');
  const [userData, setUserData] = useState<UserData | null>(null);
  
  // Stati per la modifica del profilo
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');

  // -------- GOOGLE LOGIN --------
  const redirectUri = makeRedirectUri({ scheme: 'apptricount1' } as any) + '?useProxy=true';

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '630318788048-0552kkhmfo4j7cbtfcf2a1nmbkhonuaq.apps.googleusercontent.com',
    redirectUri,
    scopes: ['profile', 'email'],
  });

  // -------- FUNZIONI UTILITY --------
  const saveUserData = async (user: UserData) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      setUserData(user);
      setScreen('logged');
    } catch (error) {
      console.error('Errore salvataggio utente:', error);
    }
  };

  const clearUserData = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      setUserData(null);
      setScreen('menu');
    } catch (error) {
      console.error('Errore logout:', error);
    }
  };

  const loadSavedUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('userData');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setUserData(user);
        setScreen('logged');
      }
    } catch (error) {
      console.error('Errore caricamento utente salvato:', error);
    }
  };

  const clearFields = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setName('');
    setSurname('');
  };

  // -------- FUNZIONI PER NAVIGAZIONE --------
  const navigateToSettings = () => {
    if (!userData) {
      Alert.alert('Errore', 'Dati utente non disponibili');
      return;
    }
    
    // Passa tutti i dati utente come parametri
    router.push({
      pathname: '/pages/impostazioni',
      params: {
        userId: userData._id,
        email: userData.email,
        username: userData.username,
        name: userData.name,
        surname: userData.surname || '',
        profileImage: userData.profileImage || ''
      }
    });
  };

  // -------- FUNZIONI MODIFICA PROFILO --------
  const handleEditProfile = () => {
    if (userData) {
      setEditUsername(userData.username);
      setEditName(userData.name);
      setEditSurname(userData.surname || '');
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditUsername('');
    setEditName('');
    setEditSurname('');
  };

  const handleSaveProfile = async () => {
    if (!userData) return;
    
    // Validazione
    if (!editUsername.trim()) {
      Alert.alert('Errore', 'L\'username è obbligatorio');
      return;
    }
    
    if (!editName.trim()) {
      Alert.alert('Errore', 'Il nome è obbligatorio');
      return;
    }

    setIsSaving(true);
    
    try {
      console.log('Aggiornamento profilo per utente:', userData._id);
      
      const res = await fetch(`${API_BASE_URL}/api/users/${userData._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userData._id
        },
        body: JSON.stringify({ 
          username: editUsername.trim(),
          name: editName.trim(),
          surname: editSurname.trim()
        }),
      });
      
      console.log('Response status:', res.status);
      const responseText = await res.text();
      console.log('Response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e: any) {
        console.error('Errore parsing JSON:', e);
        Alert.alert('Errore', 'Risposta non valida dal server');
        return;
      }
      
      if (data.success && data.user) {
        const updatedUser = {
          ...userData,
          username: data.user.username,
          name: data.user.name,
          surname: data.user.surname || '',
          profileImage: data.user.profileImage || userData.profileImage
        };
        
        await saveUserData(updatedUser);
        setIsEditing(false);
        Alert.alert('Successo', 'Profilo aggiornato con successo!');
      } else {
        Alert.alert('Errore', data.error || 'Errore durante l\'aggiornamento del profilo');
      }
    } catch (error: any) {
      console.error('Errore aggiornamento profilo:', error);
      Alert.alert('Errore', error.message || 'Errore di connessione. Riprova più tardi.');
    } finally {
      setIsSaving(false);
    }
  };

  // -------- GESTIONE IMMAGINE PROFILO CON SCELTA --------
  const showImagePickerOptions = () => {
    Alert.alert(
      'Scegli immagine',
      'Da dove vuoi selezionare l\'immagine?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Scatta una foto', onPress: handleTakePhoto },
        { text: 'Scegli dalla galleria', onPress: handlePickFromGallery },
      ]
    );
  };

  const handlePickImage = () => {
    showImagePickerOptions();
  };

  const handlePickFromGallery = async () => {
    try {
      // Chiedi i permessi per la galleria
      const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (galleryStatus !== 'granted') {
        Alert.alert(
          'Permesso necessario',
          'Per favore, concedi i permessi per accedere alla galleria fotografica.',
          [
            { text: 'Annulla', style: 'cancel' },
            { 
              text: 'OK', 
              onPress: () => {}
            }
          ]
        );
        return;
      }

      // Apri la galleria
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Errore selezione dalla galleria:', error);
      Alert.alert('Errore', 'Impossibile selezionare l\'immagine dalla galleria');
    }
  };

  const handleTakePhoto = async () => {
    try {
      // Chiedi i permessi per la fotocamera
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Permesso necessario',
          'Per favore, concedi i permessi per utilizzare la fotocamera.',
          [
            { text: 'Annulla', style: 'cancel' },
            { 
              text: 'OK', 
              onPress: () => {}
            }
          ]
        );
        return;
      }

      // Apri la fotocamera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Errore scatto foto:', error);
      Alert.alert('Errore', 'Impossibile scattare una foto');
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
    if (!userData) return;
    
    setIsUploadingImage(true);
    
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('image', {
        uri: imageUri,
        name: filename || 'profile.jpg',
        type,
      } as any);

      const res = await fetch(`${API_BASE_URL}/api/users/${userData._id}/upload-profile-image`, {
        method: 'POST',
        headers: {
          'x-user-id': userData._id,
        },
        body: formData,
      });

      console.log('Upload response status:', res.status);
      const responseText = await res.text();
      console.log('Upload response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e: any) {
        console.error('Errore parsing JSON upload:', e);
        Alert.alert('Errore', 'Risposta non valida dal server');
        return;
      }
      
      if (data.success && data.user) {
        const updatedUser = {
          ...userData,
          profileImage: data.imageUrl,
          username: data.user.username,
          name: data.user.name,
          surname: data.user.surname || ''
        };
        
        await saveUserData(updatedUser);
        Alert.alert('Successo', 'Immagine profilo aggiornata!');
      } else {
        Alert.alert('Errore', data.error || 'Errore durante l\'upload dell\'immagine');
      }
    } catch (error: any) {
      console.error('Errore upload immagine:', error);
      
      if (error instanceof Error) {
        Alert.alert('Errore', error.message);
      } else if (typeof error === 'string') {
        Alert.alert('Errore', error);
      } else {
        Alert.alert('Errore', 'Errore di connessione durante l\'upload');
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    if (!userData) return;
    
    Alert.alert(
      'Rimuovi immagine',
      'Sei sicuro di voler rimuovere la tua immagine profilo?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Rimuovi', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/users/${userData._id}/remove-profile-image`, {
                method: 'DELETE',
                headers: {
                  'x-user-id': userData._id,
                },
              });

              console.log('Remove response status:', res.status);
              const responseText = await res.text();
              console.log('Remove response:', responseText);
              
              let data;
              try {
                data = JSON.parse(responseText);
              } catch (e: any) {
                console.error('Errore parsing JSON remove:', e);
                Alert.alert('Errore', 'Risposta non valida dal server');
                return;
              }
              
              if (data.success && data.user) {
                const updatedUser = {
                  ...userData,
                  profileImage: undefined
                };
                
                await saveUserData(updatedUser);
                Alert.alert('Successo', 'Immagine profilo rimossa!');
              } else {
                Alert.alert('Errore', data.error || 'Errore durante la rimozione dell\'immagine');
              }
            } catch (error: any) {
              console.error('Errore rimozione immagine:', error);
              
              if (error instanceof Error) {
                Alert.alert('Errore', error.message);
              } else if (typeof error === 'string') {
                Alert.alert('Errore', error);
              } else {
                Alert.alert('Errore', 'Errore di connessione');
              }
            }
          }
        }
      ]
    );
  };

  // -------- EFFECTS --------
  useEffect(() => {
    loadSavedUser();
  }, []);

  // Google Login Effect
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === 'success') {
        try {
          const res = await fetch(`${API_BASE_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: response.authentication?.idToken }),
          });
          
          const data = await res.json();
          if (data.success && data.user) {
            const userWithId = {
              ...data.user,
              _id: data.user._id || data.user.id || `google_${Date.now()}`
            };
            await saveUserData(userWithId);
            clearFields();
          } else {
            alert(data.error || 'Errore login Google');
          }
        } catch (error: any) {
          console.error('Errore login Google:', error);
          alert(error.message || 'Errore di connessione');
        }
      }
    };

    handleGoogleResponse();
  }, [response]);

  // -------- EMAIL LOGIN --------
  const handleLogin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });
      
      const data = await res.json();
      
      if (data.success && data.user) {
        const userWithId = {
          ...data.user,
          _id: data.user._id || data.user.id
        };
        await saveUserData(userWithId);
        clearFields();
      } else {
        alert(data.error || 'Credenziali non valide');
      }
    } catch (error: any) {
      console.error('Errore login:', error);
      alert(error.message || 'Errore di connessione');
    }
  };

  // -------- REGISTER --------
  const handleRegister = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.toLowerCase(), 
          password, 
          username, 
          name, 
          surname 
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        const newUser: UserData = { 
          _id: data.userId || data.user?._id || `local_${Date.now()}`,
          email: email.toLowerCase(), 
          username, 
          name, 
          surname
        };
        await saveUserData(newUser);
        clearFields();
      } else {
        alert(data.error || 'Errore registrazione');
      }
    } catch (error: any) {
      console.error('Errore registrazione:', error);
      alert(error.message || 'Errore di connessione');
    }
  };

  // -------- LOGOUT --------
  const handleLogout = async () => {
  Alert.alert(
    'Conferma logout',
    'Sei sicuro di voler uscire dal tuo account?',
    [
      { text: 'Annulla', style: 'cancel' },
      { 
        text: 'Esci', 
        style: 'destructive',
        onPress: async () => {
          // Rimuove dati utente
          await clearUserData();

          // Pulisce campi locali
          clearFields();

          // Opzionale: rimanda al login
          router.push('/profile');
        }
      }
    ]
  );
};


  // -------- MODALE MODIFICA PROFILO AGGIORNATO --------
  const renderEditProfileModal = () => (
    <Modal
      visible={isEditing}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancelEdit}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Modifica Profilo</Text>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {/* Sezione immagine profilo */}
            <View style={styles.modalAvatarSection}>
              <TouchableOpacity 
                style={styles.modalAvatarContainer}
                onPress={handlePickImage}
                disabled={isUploadingImage}
              >
                {userData?.profileImage ? (
                  <Image 
                    source={{ uri: userData.profileImage }} 
                    style={styles.modalAvatarImage}
                  />
                ) : (
                  <View style={styles.modalAvatarPlaceholder}>
                    <Text style={styles.modalAvatarText}>
                      {userData?.name?.[0]?.toUpperCase() || userData?.username?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                
                {/* Overlay per cambiare immagine */}
                <View style={styles.changeImageOverlay}>
                  <Ionicons name="camera" size={20} color="white" />
                </View>
                
                {isUploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="white" size="small" />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.modalAvatarButtons}>
                
                {userData?.profileImage && (
                  <TouchableOpacity 
                    style={[styles.modalAvatarButton, styles.removeAvatarButton]}
                    onPress={handleRemoveProfileImage}
                    disabled={isUploadingImage}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC3545" />
                    <Text style={[styles.modalAvatarButtonText, { color: '#DC3545' }]}>Rimuovi</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Form di modifica */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Username *</Text>
              <TextInput
                style={styles.modalInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="Il tuo username"
                autoCapitalize="none"
                editable={!isSaving}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome *</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Il tuo nome"
                autoCapitalize="words"
                editable={!isSaving}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Cognome</Text>
              <TextInput
                style={styles.modalInput}
                value={editSurname}
                onChangeText={setEditSurname}
                placeholder="Il tuo cognome"
                autoCapitalize="words"
                editable={!isSaving}
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[styles.modalInput, styles.disabledInput]}
                value={userData?.email || ''}
                editable={false}
              />
              <Text style={styles.inputHint}>
                L'email non può essere modificata
              </Text>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={handleCancelEdit}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton, isSaving && styles.saveButtonDisabled]} 
              onPress={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Salva Modifiche</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ---------------- RENDER SCREEN LOGGED ----------------
  if (screen === 'logged' && userData) {
    return (
      <SafeAreaView style={styles.loggedContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        {renderEditProfileModal()}
        
        {/* Header */}
        <View style={styles.loggedHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handlePickImage}
              disabled={isUploadingImage}
            >
              {userData.profileImage ? (
                <Image 
                  source={{ uri: userData.profileImage }} 
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {userData.name?.[0]?.toUpperCase() || userData.username?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.onlineIndicator} />
              {isUploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="white" size="small" />
                </View>
              )}
            </TouchableOpacity>
            
            <Text style={styles.userName}>
              {userData.name} {userData.surname}
            </Text>
            <Text style={styles.userUsername}>@{userData.username}</Text>
            <Text style={styles.userEmail}>{userData.email}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        <ScrollView 
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Il tuo account</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="person-outline" size={22} color="#188c65" />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Profilo personale</Text>
                  <Text style={styles.menuItemSubtitle}>Modifica le tue informazioni</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CED4DA" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="lock-closed-outline" size={22} color="#1976D2" />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Sicurezza</Text>
                  <Text style={styles.menuItemSubtitle}>Password e privacy</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CED4DA" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={navigateToSettings}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="settings-outline" size={22} color="#F57C00" />
                </View>
                <View>
                  <Text style={styles.menuItemTitle}>Impostazioni</Text>
                  <Text style={styles.menuItemSubtitle}>Preferenze e notifiche</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CED4DA" />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#DC3545" style={{ marginRight: 10 }} />
            <Text style={styles.logoutButtonText}>Esci dall'account</Text>

          </TouchableOpacity>

          <Text style={styles.versionText}>Time2Pay v1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------------- RENDER SCREENS NON LOGGED ----------------
  if (screen === 'menu') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Accedi</Text>

        <TouchableOpacity style={styles.buttonLogin}>
          <Image source={require('@/assets/images/apple.png')} style={{ width: 18, height: 20 }} />
          <Text style={styles.textLogin}>Accedi con Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.buttonLogin} 
          onPress={() => promptAsync()} 
          disabled={!request}
        >
          <Image source={require('@/assets/images/google.png')} style={{ width: 20, height: 18 }} />
          <Text style={styles.textLogin}>Accedi con Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonLogin}>
          <Image source={require('@/assets/images/facebook.png')} style={{ width: 18, height: 20 }} />
          <Text style={styles.textLogin}>Accedi con Facebook</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonLogin} onPress={() => setScreen('login')}>
          <Text style={styles.textLogin}>Accedi con la tua email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen('register')} style={{ marginTop: 10 }}>
          <Text style={styles.registerText}>Non hai un account? Registrati</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'login') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Accedi con Email</Text>
        <TextInput 
          placeholder="Email" 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput 
          placeholder="Password" 
          style={styles.input} 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Accedi</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen('register')} style={{ marginTop: 10 }}>
          <Text style={styles.registerText}>Non hai un account? Registrati</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen('menu')} style={{ marginTop: 10 }}>
          <Text style={styles.backText}>Torna al menu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'register') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
        <Text style={styles.title}>Registrati</Text>
        <TextInput 
          placeholder="Email" 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput 
          placeholder="Password" 
          style={styles.input} 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="Username" 
          style={styles.input} 
          value={username} 
          onChangeText={setUsername} 
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="Nome" 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="Cognome" 
          style={styles.input} 
          value={surname} 
          onChangeText={setSurname} 
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.loginButton} onPress={handleRegister}>
          <Text style={styles.loginButtonText}>Registrati</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen('login')} style={{ marginTop: 10 }}>
          <Text style={styles.registerText}>Hai già un account? Accedi</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen('menu')} style={{ marginTop: 10 }}>
          <Text style={styles.backText}>Torna al menu</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // Stili per screens non logged (invariati)
  container: { 
    flex: 1, 
    paddingHorizontal: width * 0.1, 
    paddingTop: 50, 
    backgroundColor: 'white' 
  },
  title: { 
    fontSize: 25, 
    fontWeight: '500', 
    marginBottom: 20, 
    textAlign: 'center', 
    color: '#188c65' 
  },
  buttonLogin: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#e2e2e2', 
    paddingVertical: 15, 
    paddingHorizontal: 20, 
    borderRadius: 10, 
    marginBottom: 15 
  },
  textLogin: { 
    fontSize: 18, 
    fontWeight: '500', 
    marginLeft: 5 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#c8c8c8', 
    borderRadius: 10, 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    marginBottom: 15,
    fontSize: 16
  },
  loginButton: { 
    backgroundColor: '#188c65', 
    paddingVertical: 15, 
    borderRadius: 10,
    marginTop: 10
  },
  loginButtonText: { 
    color: 'white', 
    textAlign: 'center', 
    fontWeight: '500', 
    fontSize: 18 
  },
  registerText: { 
    color: '#188c65', 
    textAlign: 'center', 
    fontSize: 16 
  },
  backText: { 
    textAlign: 'center', 
    fontSize: 16, 
    color: 'gray' 
  },

  // Stili per schermata logged
  loggedContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loggedHeader: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#188c65',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 4,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: 14,
    color: '#ADB5BD',
    marginBottom: 16,
  },
  editProfileButton: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    flexDirection: 'row',
    alignItems: 'center',
  },
  editProfileText: {
    color: '#188c65',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#188c65',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
    marginTop: 20,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 16,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#6C757D',
  },
  inviteCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 8,
  },
  inviteIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
    textAlign: 'center',
  },
  inviteDescription: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  inviteButton: {
    backgroundColor: '#188c65',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: 'white',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FFE5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#DC3545',
    fontSize: 16,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: '#ADB5BD',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },

  // Stili per il modal di modifica profilo
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'white',
  },
  disabledInput: {
    backgroundColor: '#F8F9FA',
    color: '#6C757D',
  },
  inputHint: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 6,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  cancelButtonText: {
    color: '#6C757D',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#188c65',
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  modalAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  modalAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  modalAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#188c65',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  removeAvatarButton: {
    backgroundColor: '#FFE5E5',
    borderColor: '#FFCCCC',
  },
  modalAvatarButtonText: {
    color: '#188c65',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  changeImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(24, 140, 101, 0.8)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarHint: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 8,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  galleryButton: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  cameraButton: {
    backgroundColor: '#E3F2FD',
    borderColor: '#BBDEFB',
  },
  
  // Aggiorna questi stili per i pulsanti immagine
  modalAvatarButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  modalAvatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 120,
    justifyContent: 'center',
  },
  
});