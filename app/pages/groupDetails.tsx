import ProfileImageModal from '@/components/ProfileImageModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Image, Keyboard, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import '../../assets/images/profile.png';

type Props = {
  foto: string;
  nome: string;
  createdAt: string;
  createdBy: string;
  members: string[];
  totalExp: number;
};

export default function Details({ foto, nome, createdAt, createdBy, members, totalExp }:Props) {

  const imageSource = foto && foto.trim() !== '' ? { uri: foto } : require('../../assets/images/profile.png');
  const [fotoProfilo, setFotoProfilo] = useState(imageSource);
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(200)).current;

  const openModal = () => {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(fadeAnim,{toValue:1,duration:200,useNativeDriver:true}),
      Animated.spring(slideAnim,{toValue:0,bounciness:5,useNativeDriver:true}),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,{toValue:0,duration:200,useNativeDriver:true}),
      Animated.timing(slideAnim,{toValue:200,duration:200,useNativeDriver:true})
    ]).start(()=>setModalVisible(false));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.page}>
        {!modalVisible && (
          <TouchableWithoutFeedback onPress={() => {Keyboard.dismiss();}}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}

        <ProfileImageModal
          visible={modalVisible}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
          onClose={closeModal}
          onTakePhoto={() => console.log('Take photo')}
          onPickFromGallery={() => console.log('Pick from gallery')}
          onDeletePhoto={() => console.log('Delete photo')}
        />

        <View style={styles.header}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={openModal}>
            <Image source={fotoProfilo} style={styles.avatar}/>
          </TouchableOpacity>

          <View style={styles.creationWrapper}>
            <View style={styles.creationRow}>
              <Text style={styles.creationGruppo}>by </Text>
              <Text style={{...styles.creationGruppo,fontWeight:'600'}}>{createdBy}</Text>
              <Text style={styles.creationGruppo}>,</Text>
            </View>
            <Text style={styles.creationGruppo}>{createdAt}</Text>
          </View>
        </View>

        <View style={styles.membri}>
          <Text style={{fontSize:18,marginVertical:10}}>Members:</Text>

          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {members.map((m,i) => (
              <View key={i} style={styles.membro}>
                <Text style={{fontSize:20}}>{m}</Text>
                <Text style={{
                  fontSize:18,
                  fontWeight:'600',
                  color:i>0?'rgba(24,140,101,1)' : 'rgba(237,29,29,1)',
                  alignSelf:'center'
                }}>
                  {(10).toLocaleString('it-IT',{style:'currency',currency:'EUR'})}
                </Text>
              </View>
            ))}
          </ScrollView>

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255, 255, 255, 0)','rgba(255, 255, 255, 1)']}
            style={styles.fadeBottom}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page:{ flex:1 },
  header:{
    flex:0.2,
    flexDirection:'row',
    marginHorizontal:50,
  },
  avatarWrapper:{
    alignSelf:'center',
    marginRight:20,
  },
  avatar:{
    width:100,
    height:100,
    borderRadius:5,
    overflow:'hidden',
  },
  creationWrapper:{
    alignSelf:'center',
  },
  creationRow:{
    flexDirection:'row',
  },
  creationGruppo:{
    fontSize:16,
  },
  membri:{
    flex:0.7,
    marginHorizontal:40,
  },
  membro:{
    borderWidth:2,
    borderColor:'rgba(24, 140, 101, 1)',
    borderRadius:10,
    overflow:'hidden',
    marginHorizontal:10,
    marginVertical:10,
    paddingVertical:15,
    paddingHorizontal:10,
    flexDirection:'row',
    justifyContent:'space-between',
  },
  fadeBottom:{
    position:'absolute',
    bottom:0,
    left:0,
    right:0,
    height:100,
  },
});
