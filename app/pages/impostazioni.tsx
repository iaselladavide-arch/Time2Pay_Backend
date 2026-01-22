import { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';



export const unstable_settings = {
  headerShown: false,
};

const API_BASE_URL = 'http://10.178.160.160:3000';

export default function ImpostazioniScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Disattiva header nativo del parent stack
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ headerShown: false });

    return () => {
      parent?.setOptions({ headerShown: true });
    };
  }, [navigation]);
  
  const params = useLocalSearchParams();

  const userData = {
    _id: params.userId as string,
    email: params.email as string,
    username: params.username as string,
    name: params.name as string,
    surname: params.surname as string,
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteStep, setDeleteStep] = useState(1);

  // -------------------- FUNZIONI --------------------
  const handleDeleteAccount = async () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }

    if (deleteStep === 2) {
      if (confirmEmail.toLowerCase() !== userData.email.toLowerCase()) {
        Alert.alert('Errore', 'L\'email inserita non corrisponde al tuo account.');
        return;
      }
      if (confirmText.toLowerCase() !== 'elimina il mio account') {
        Alert.alert('Errore', 'Devi scrivere esattamente "elimina il mio account" per confermare.');
        return;
      }

      setIsDeleting(true);

      try {
        const res = await fetch(`${API_BASE_URL}/api/users/${userData._id}/delete-account`, {
          method: 'DELETE',
          headers: {
            'x-user-id': userData._id,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        if (data.success) {
          setDeleteStep(3);
        } else {
          Alert.alert('Errore', data.error || 'Impossibile eliminare l\'account. Riprova più tardi.');
          setIsDeleting(false);
        }
      } catch (error) {
        console.error('Errore eliminazione account:', error);
        try {
          await AsyncStorage.removeItem('userData');
          setDeleteStep(3);
        } catch {
          Alert.alert('Errore', 'Impossibile eliminare i dati locali. Riprova più tardi.');
          setIsDeleting(false);
        }
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
    setConfirmEmail('');
    setConfirmText('');
    setIsDeleting(false);
  };

  const completeDelete = () => {
    AsyncStorage.clear()
      .then(() => router.replace('/(tabs)/profile'))
      .catch(() => router.replace('/(tabs)/profile'));
  };

  const handleLogout = () => {
    AsyncStorage.removeItem('userData')
      .then(() => router.replace('/(tabs)/profile'))
      .catch(() => router.replace('/(tabs)/profile'));
  };

  const renderDeleteModalContent = () => {
    switch (deleteStep) {
      case 1:
        return (
          <View style={styles.modalStepContent}>
            <Ionicons name="warning" size={60} color="#DC3545" style={styles.warningIcon} />
            <Text style={styles.modalTitle}>Attenzione!</Text>
            <Text style={styles.modalText}>
              Stai per eliminare definitivamente il tuo account. Questa azione è IRREVERSIBILE.
            </Text>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Cosa verrà eliminato:</Text>
              <Text style={styles.warningItem}>• Il tuo profilo utente</Text>
              <Text style={styles.warningItem}>• Tutti i tuoi gruppi</Text>
              <Text style={styles.warningItem}>• Tutte le spese registrate</Text>
              <Text style={styles.warningItem}>• Lo storico dei pagamenti</Text>
              <Text style={styles.warningItem}>• Le tue impostazioni</Text>
            </View>

            <Text style={styles.modalText}>Sei sicuro di voler procedere?</Text>
          </View>
        );
      case 2:
        return (
          <View style={styles.modalStepContent}>
            <Ionicons name="alert-circle" size={60} color="#DC3545" style={styles.warningIcon} />
            <Text style={styles.modalTitle}>Conferma finale</Text>
            <Text style={styles.modalText}>
              Per confermare l'eliminazione, inserisci le seguenti informazioni:
            </Text>

            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>
                Digita la tua email: <Text style={styles.userEmail}>{userData.email}</Text>
              </Text>
              <TextInput
                style={styles.confirmInput}
                placeholder="Incolla qui la tua email"
                value={confirmEmail}
                onChangeText={setConfirmEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isDeleting}
              />
            </View>

            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>
                Digita esattamente: <Text style={styles.confirmPhrase}>"elimina il mio account"</Text>
              </Text>
              <TextInput
                style={styles.confirmInput}
                placeholder='Scrivi "elimina il mio account"'
                value={confirmText}
                onChangeText={setConfirmText}
                editable={!isDeleting}
              />
            </View>

            {isDeleting && <ActivityIndicator size="large" color="#DC3545" style={styles.loadingIndicator} />}
          </View>
        );
      case 3:
        return (
          <View style={styles.modalStepContent}>
            <Ionicons name="checkmark-circle" size={60} color="#188c65" style={styles.successIcon} />
            <Text style={styles.modalTitle}>Account eliminato</Text>
            <Text style={styles.modalText}>
              Il tuo account è stato eliminato con successo. Tutti i tuoi dati sono stati rimossi dal nostro sistema.
            </Text>
            <Text style={styles.modalText}>
              Ci dispiace vederti andare via! Speriamo di rivederti presto.
            </Text>
          </View>
        );
    }
  };

  const renderDeleteModalButtons = () => {
    switch (deleteStep) {
      case 1:
        return (
          <>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={cancelDelete}>
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.deleteButton]} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={20} color="white" />
              <Text style={styles.deleteButtonText}>Procedi con l'eliminazione</Text>
            </TouchableOpacity>
          </>
        );
      case 2:
        return (
          <>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={cancelDelete} disabled={isDeleting}>
              <Text style={styles.cancelButtonText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? <ActivityIndicator color="white" size="small" /> : <>
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.deleteButtonText}>Elimina definitivamente</Text>
              </>}
            </TouchableOpacity>
          </>
        );
      case 3:
        return (
          <TouchableOpacity style={[styles.modalButton, styles.finalButton]} onPress={completeDelete}>
            <Text style={styles.finalButtonText}>Torna alla home</Text>
          </TouchableOpacity>
        );
    }
  };

  // -------------------- RENDER --------------------
  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <View style={styles.headerRight} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <ScrollView style={styles.content}>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountInfo}>
              <View style={styles.accountRow}>
                <Ionicons name="person-outline" size={20} color="#6C757D" />
                <Text style={styles.accountLabel}>Nome:</Text>
                <Text style={styles.accountValue}>{userData.name} {userData.surname}</Text>
              </View>
              <View style={styles.accountRow}>
                <Ionicons name="at" size={20} color="#6C757D" />
                <Text style={styles.accountLabel}>Username:</Text>
                <Text style={styles.accountValue}>@{userData.username}</Text>
              </View>
              <View style={styles.accountRow}>
                <Ionicons name="mail-outline" size={20} color="#6C757D" />
                <Text style={styles.accountLabel}>Email:</Text>
                <Text style={styles.accountValue}>{userData.email}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Area pericolosa</Text>
            <View style={styles.dangerCard}>
              <View style={styles.dangerHeader}>
                <Ionicons name="warning" size={24} color="#DC3545" />
                <Text style={styles.dangerTitle}>Elimina account</Text>
              </View>
              <Text style={styles.dangerText}>
                Una volta eliminato il tuo account, non potrai più recuperare i tuoi dati. Questa azione rimuoverà permanentemente:
              </Text>
              <View style={styles.dangerList}>
                <Text style={styles.dangerItem}>• Il tuo profilo utente</Text>
                <Text style={styles.dangerItem}>• Tutti i gruppi di cui sei membro</Text>
                <Text style={styles.dangerItem}>• Tutte le spese registrate</Text>
                <Text style={styles.dangerItem}>• Lo storico delle transazioni</Text>
              </View>
              <TouchableOpacity style={styles.deleteAccountButton} onPress={() => setShowDeleteModal(true)}>
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.deleteAccountButtonText}>Elimina il mio account</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Time2Pay v1.0.0</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={deleteStep === 3 ? completeDelete : cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {renderDeleteModalContent()}
            <View style={styles.modalButtons}>{renderDeleteModalButtons()}</View>
          </View>
        </View>
      </Modal>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    marginTop: 12,
    padding: 4,
  },
  headerTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  accountInfo: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountLabel: {
    fontSize: 14,
    color: '#6C757D',
    marginLeft: 12,
    marginRight: 8,
    width: 70,
  },
  accountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
    flex: 1,
  },
  dangerCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC3545',
    marginLeft: 12,
  },
  dangerText: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
    marginBottom: 16,
  },
  dangerList: {
    marginBottom: 24,
  },
  dangerItem: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 6,
    lineHeight: 20,
  },
  deleteAccountButton: {
    backgroundColor: '#DC3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  deleteAccountButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#ADB5BD',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalStepContent: {
    padding: 24,
    alignItems: 'center',
  },
  warningIcon: {
    marginBottom: 20,
  },
  successIcon: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    width: '100%',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C53030',
    marginBottom: 8,
  },
  warningItem: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 4,
  },
  confirmSection: {
    marginBottom: 20,
    width: '100%',
  },
  confirmLabel: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 8,
  },
  userEmail: {
    fontWeight: '600',
    color: '#188c65',
  },
  confirmPhrase: {
    fontWeight: '600',
    color: '#DC3545',
    fontStyle: 'italic',
  },
  confirmInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F7FAFC',
  },
  loadingIndicator: {
    marginVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    padding: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
  deleteButton: {
    backgroundColor: '#DC3545',
  },
  deleteButtonDisabled: {
    backgroundColor: '#F5A9A9',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  finalButton: {
    backgroundColor: '#188c65',
  },
  finalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});