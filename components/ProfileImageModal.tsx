// ProfileImageModal.tsx
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

type Props = {
  visible: boolean;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  onClose: () => void;
  onTakePhoto?: () => void;
  onPickFromGallery?: () => void;
  onDeletePhoto?: () => void;
};

export default function ProfileImageModal({
  visible,
  fadeAnim,
  slideAnim,
  onClose,
  onTakePhoto,
  onPickFromGallery,
  onDeletePhoto,
}: Props) {

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
              <Text style={styles.title}>Cambia immagine</Text>

              {onTakePhoto && (
                <TouchableOpacity onPress={onTakePhoto} style={styles.button}>
                  <Text style={styles.buttonText}>Scatta una foto</Text>
                </TouchableOpacity>
              )}

              {onPickFromGallery && (
                <TouchableOpacity onPress={onPickFromGallery} style={styles.button}>
                  <Text style={styles.buttonText}>Scegli dalla galleria</Text>
                </TouchableOpacity>
              )}

              <View style={styles.rowButtons}>
                {onDeletePhoto && (
                  <TouchableOpacity onPress={onDeletePhoto} style={[styles.button, styles.halfButton]}>
                    <Text style={[styles.buttonText, { color: 'red' }]}>Elimina foto</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={onClose} style={[styles.button, styles.halfButton]}>
                  <Text style={[styles.buttonText, { color: 'red' }]}>Annulla</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 25,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.6)',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 15,
  },
  buttonText: {
    fontSize: 18,
    color: '#007aff',
    textAlign: 'center',
  },
  rowButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  halfButton: {
    flex: 1,
    marginHorizontal: 5,
  },
});
