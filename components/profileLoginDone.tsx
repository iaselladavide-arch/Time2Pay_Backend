import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState, useEffect } from 'react';
import { Animated, Image, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View, Alert, ActivityIndicator } from 'react-native';
import ProfileImageModal from "./ProfileImageModal";
import { IconSymbol } from './ui/icon-symbol';

const API_URL = 'http://10.178.160.160:3000';

interface User {
  _id: string; // Aggiungi questo campo!
  email: string;
  username: string;
  name: string;
  surname: string;
  profileImage?: string; // Aggiungi questo campo
}

interface ProfileLoginDoneProps {
  user: User;
  onLogout: () => void;
}

export default function ProfileLoginDone({ user, onLogout }: ProfileLoginDoneProps) {
    const router = useRouter();
    const [profileImage, setProfileImage] = useState<any>(require('../assets/images/profile.png'));
    const [uploadingImage, setUploadingImage] = useState(false);
    const [editingField, setEditingField] = useState<null | string>(null);
    const emailRef = useRef<TextInput>(null);
    const usernameRef = useRef<TextInput>(null);
    const nameRef = useRef<TextInput>(null);
    const surnameRef = useRef<TextInput>(null);

    // ---- MODALE ----
    const [modalVisible, setModalVisible] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(200)).current;

    // Carica l'immagine profilo dal backend all'avvio
    useEffect(() => {
        loadProfileImage();
    }, [user._id]);

    const loadProfileImage = async () => {
        try {
            if (user.profileImage) {
                // Se l'utente ha già un'immagine salvata nel backend
                setProfileImage({ uri: user.profileImage });
            }
        } catch (error) {
            console.error('Errore caricamento immagine profilo:', error);
        }
    };

    const openModal = () => {
        setModalVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, bounciness: 5, useNativeDriver: true }),
        ]).start();
    };

    const closeModal = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 200, duration: 200, useNativeDriver: true }),
        ]).start(() => setModalVisible(false));
    };

    // ---- FUNZIONI PER L'IMMAGINE PROFILO ----
    const uploadProfileImage = async (imageUri: string) => {
        try {
            setUploadingImage(true);
            
            const formData = new FormData();
            
            // CORREGGI QUI: Il backend aspetta il campo 'image' (singolare)
            const filename = imageUri.split('/').pop() || `profile-${user._id}-${Date.now()}.jpg`;
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';
            
            // NOTA: Il campo deve chiamarsi 'image' (come nel backend)
            formData.append('image', {
            uri: imageUri,
            type: type,
            name: filename,
            } as any);

            console.log('Uploading image to:', `${API_URL}/api/users/${user._id}/upload-profile-image`);
            console.log('FormData filename:', filename);
            console.log('FormData type:', type);
            
            const response = await fetch(`${API_URL}/api/users/${user._id}/upload-profile-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data',
                'x-user-id': user._id,
            },
            body: formData,
            });

            const data = await response.json();
            console.log('Upload response:', data);

            if (data.success && data.imageUrl) {
                // Aggiorna l'immagine localmente
                setProfileImage({ uri: data.imageUrl });
                
                // Aggiorna AsyncStorage con la nuova immagine
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const savedUser = await AsyncStorage.getItem('userData');
                if (savedUser) {
                    const userData = JSON.parse(savedUser);
                    userData.profileImage = data.imageUrl;
                    await AsyncStorage.setItem('userData', JSON.stringify(userData));
                }
                
                Alert.alert('Successo', 'Immagine profilo aggiornata');
            } else {
                Alert.alert('Errore', data.error || 'Impossibile caricare l\'immagine');
            }
        } catch (error) {
            console.error('Errore upload immagine:', error);
            Alert.alert('Errore', 'Impossibile connettersi al server');
        } finally {
            setUploadingImage(false);
        }
    };

    const removeProfileImage = async () => {
        try {
            const response = await fetch(`${API_URL}/api/users/${user._id}/remove-profile-image`, {
                method: 'DELETE',
                headers: {
                    'x-user-id': user._id,
                },
            });

            const data = await response.json();

            if (data.success) {
                // Torna all'immagine predefinita
                setProfileImage(require('../assets/images/profile.png'));
                
                // Aggiorna AsyncStorage rimuovendo l'immagine
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const savedUser = await AsyncStorage.getItem('userData');
                if (savedUser) {
                    const userData = JSON.parse(savedUser);
                    delete userData.profileImage;
                    await AsyncStorage.setItem('userData', JSON.stringify(userData));
                }
                
                Alert.alert('Successo', 'Immagine rimossa');
            } else {
                Alert.alert('Errore', data.error || 'Impossibile rimuovere l\'immagine');
            }
        } catch (error) {
            console.error('Errore rimozione immagine:', error);
            Alert.alert('Errore', 'Impossibile connettersi al server');
        }
    };

    // ---- AZIONI FOTO ----
    const pickFromGallery = async () => {
        closeModal();
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { 
            alert("Permesso necessario per accedere alla galleria."); 
            return; 
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({ 
            mediaTypes: ImagePicker.MediaTypeOptions.Images, 
            allowsEditing: true, 
            aspect: [1,1], 
            quality: 0.7 
        });
        
        if (!result.canceled) {
            await uploadProfileImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        closeModal();
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { 
            alert("Permesso necessario per usare la fotocamera."); 
            return; 
        }
        
        const result = await ImagePicker.launchCameraAsync({ 
            allowsEditing: true, 
            aspect: [1,1], 
            quality: 0.7 
        });
        
        if (!result.canceled) {
            await uploadProfileImage(result.assets[0].uri);
        }
    };

    const deletePhoto = () => { 
        Alert.alert(
            'Rimuovi immagine',
            'Sei sicuro di voler rimuovere l\'immagine profilo?',
            [
                { text: 'Annulla', style: 'cancel' },
                { 
                    text: 'Rimuovi', 
                    style: 'destructive',
                    onPress: async () => {
                        await removeProfileImage();
                    }
                }
            ]
        );
    };

    // ---- SALVA MODIFICHE AI CAMPI TESTO ----
    const saveField = async (field: string, value: string) => {
        try {
            const response = await fetch(`${API_URL}/api/users/${user._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user._id,
                },
                body: JSON.stringify({ [field]: value }),
            });

            const data = await response.json();

            if (data.success) {
                // Aggiorna AsyncStorage
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const savedUser = await AsyncStorage.getItem('userData');
                if (savedUser) {
                    const userData = JSON.parse(savedUser);
                    userData[field] = value;
                    await AsyncStorage.setItem('userData', JSON.stringify(userData));
                }
                
                Alert.alert('Successo', 'Modifica salvata');
            } else {
                Alert.alert('Errore', data.error || 'Impossibile salvare la modifica');
            }
        } catch (error) {
            console.error('Errore salvataggio campo:', error);
            Alert.alert('Errore', 'Impossibile connettersi al server');
        }
    };

    return (
        <TouchableWithoutFeedback onPress={() => { setEditingField(null); Keyboard.dismiss(); }}>
            <View style={styles.Page}>

                {/* LOGOUT BUTTON */}
                <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
                    <Text style={styles.logoutText}>Esci</Text>
                </TouchableOpacity>

                {/* MODALE CAMBIO FOTO */}
                <ProfileImageModal
                    visible={modalVisible}
                    fadeAnim={fadeAnim}
                    slideAnim={slideAnim}
                    onClose={closeModal}
                    onTakePhoto={takePhoto}
                    onPickFromGallery={pickFromGallery}
                    onDeletePhoto={deletePhoto}
                />

                <ScrollView style={{ flex:1 }} contentContainerStyle={{ paddingBottom: 50 }}>
                    <TouchableOpacity style={styles.Image} onPress={openModal} disabled={uploadingImage}>
                        {uploadingImage ? (
                            <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center' }]}>
                                <ActivityIndicator size="large" color="#188c65" />
                            </View>
                        ) : (
                            <Image source={profileImage} style={styles.profileImage} />
                        )}
                    </TouchableOpacity>

                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>E-mail</Text>
                        <View style={styles.campo}>
                            <TextInput 
                                ref={emailRef} 
                                style={styles.testoCampo} 
                                value={user.email} 
                                editable={editingField==='email'} 
                                selectTextOnFocus 
                                onBlur={() => editingField === 'email' && saveField('email', user.email)}
                            />
                            <TouchableOpacity onPress={() => { 
                                setEditingField('email'); 
                                setTimeout(() => emailRef.current?.focus(), 50); 
                            }}>
                                <IconSymbol name="pencil" color="black" size={20}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>Username</Text>
                        <View style={styles.campo}>
                            <TextInput 
                                ref={usernameRef} 
                                style={styles.testoCampo} 
                                value={user.username} 
                                editable={editingField==='username'} 
                                selectTextOnFocus 
                                onBlur={() => editingField === 'username' && saveField('username', user.username)}
                            />
                            <TouchableOpacity onPress={() => { 
                                setEditingField('username'); 
                                setTimeout(() => usernameRef.current?.focus(), 50); 
                            }}>
                                <IconSymbol name="pencil" color="black" size={20}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>Nome</Text>
                        <View style={styles.campo}>
                            <TextInput 
                                ref={nameRef} 
                                style={styles.testoCampo} 
                                value={user.name} 
                                editable={editingField==='name'} 
                                selectTextOnFocus 
                                onBlur={() => editingField === 'name' && saveField('name', user.name)}
                            />
                            <TouchableOpacity onPress={() => { 
                                setEditingField('name'); 
                                setTimeout(() => nameRef.current?.focus(), 50); 
                            }}>
                                <IconSymbol name="pencil" color="black" size={20}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>Cognome</Text>
                        <View style={styles.campo}>
                            <TextInput 
                                ref={surnameRef} 
                                style={styles.testoCampo} 
                                value={user.surname} 
                                editable={editingField==='surname'} 
                                selectTextOnFocus 
                                onBlur={() => editingField === 'surname' && saveField('surname', user.surname)}
                            />
                            <TouchableOpacity onPress={() => { 
                                setEditingField('surname'); 
                                setTimeout(() => surnameRef.current?.focus(), 50); 
                            }}>
                                <IconSymbol name="pencil" color="black" size={20}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                </ScrollView>
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    Page: { flex:1, position:'relative', backgroundColor:'white' },
    Image: { marginHorizontal:'auto', marginTop:30, marginBottom:30 },
    profileImage: { borderWidth:1, width:200, height:200, aspectRatio:1, borderRadius:100 },
    titoloTesto: { marginBottom:30, marginHorizontal:40 },
    campo: { flexDirection:'row', justifyContent:'space-between' },
    testo: { fontSize:16, marginVertical:'auto', color:'#188c65' },
    testoCampo: { fontSize:20, fontWeight:'500', marginVertical:'auto', paddingVertical:5, width:'90%', borderBottomWidth:0.5 },
    logoutButton: { position:'absolute', top:50, right:15, backgroundColor:'red', paddingHorizontal:14, paddingVertical:8, borderRadius:8, zIndex:10 },
    logoutText: { color:'white', fontWeight:'600' }
});