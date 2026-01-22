import Spesa from '@/components/spesa';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useRef } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const data = [
  {description: 'Hotel 2 notti', gruppo:'Weekend a Roma', totalAmount: 18, creator: 'Casucci Valentina', splitBetween: ['me','IasellaDavide'], done: false},
  {description: 'Hotel 4 notti', gruppo:'Weekend a Milano', totalAmount: 80.5, creator: 'me', splitBetween: ['me','Iasella Davide'], done: true},
  {description: 'Hotel 1 notte', gruppo:'Weekend a Valencia', totalAmount: 1, creator: 'me', splitBetween: ['me', 'Casucci Valentina'], done: true},
];

export default function History() {

  const searchRef = useRef<TextInput>(null);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.page}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()} />

        <View style={styles.riepilogoSpese}>
          <View style={styles.summaryBlock}>
            <Text style={styles.riepilogoSpeseTitolo}>Total expense</Text>
            <Text style={styles.riepilogoSpeseCampo}>
              {(10).toLocaleString('it-IT',{style:'currency',currency:'EUR'})}
            </Text>
          </View>

          <View style={styles.summaryBlock}>
            <Text style={styles.riepilogoSpeseTitolo}>My expense</Text>
            <Text style={styles.riepilogoSpeseCampo}>
              {(10).toLocaleString('it-IT',{style:'currency',currency:'EUR'})}
            </Text>
          </View>
        </View>

        <View style={styles.list}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {data.map((d,i)=>(
              <Spesa key={i} {...d} data={new Date().toLocaleDateString('it-IT')} />
            ))}
          </ScrollView>

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255, 255, 255, 0)','rgba(255, 255, 255, 1)']}
            style={styles.fadeBottom}
          />
        </View>

        <TouchableOpacity style={styles.add} onPress={()=>{}}>
          <Text style={styles.LinkText}>Add expense</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page:{ flex:1 },

  riepilogoSpese:{
    flex:0.1,
    flexDirection:'row',
    marginHorizontal:20,
    justifyContent:'space-around',
  },

  summaryBlock:{
    flex:1,
    alignItems:'center',
  },

  riepilogoSpeseTitolo:{
    fontSize:16,
    textAlign:'center',
  },

  riepilogoSpeseCampo:{
    fontSize:22,
    textAlign:'center',
    marginTop:5,
    fontWeight:'600',
  },

  list:{ flex:0.7 },

  fadeBottom:{
    position:'absolute',
    bottom:0,
    left:0,
    right:0,
    height:100,
  },

  add:{
    position:'absolute',
    bottom:80,
    alignSelf:'center',   // FIX instead of left + translate
    borderWidth:2,
    borderColor:'rgba(24, 140, 101, 1)',
    borderRadius:10,
    overflow:'hidden',
    backgroundColor:'rgba(24, 140, 101, 0.2)',
    paddingVertical:10,
    paddingHorizontal:20,
  },

  LinkText:{ fontSize:20 },
});
