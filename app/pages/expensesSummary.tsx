import Spesa from '@/components/spesa';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import ModalFiltri from './modalFiltri';
import { Expense } from '../../backend/types/expense';

interface SummaryProps {
  expenses: Expense[];
}

export default function Summary({ expenses }: SummaryProps) {
  const [editingField, setEditingField] = useState<null | string>(null);
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState(false);
  const [filterDate, setFilterDate] = useState<null | Date>(null);
  const [filterImport, setFilterImport] = useState<null | [number, number]>(null);
  const [filterOrder, setFilterOrder] = useState<null | string>(null);
  const [filterTag, setFilterTag] = useState<null | [string,string]>(null);
  const searchRef = useRef<TextInput>(null);

  // ---- MODALE ----
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;    // sfondo fade
  const slideAnim = useRef(new Animated.Value(200)).current; // contenuto dal basso

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
      Animated.timing(slideAnim, { toValue: 800, duration: 200, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <TouchableWithoutFeedback
        onPress={() => {
          setEditingField(null);
          Keyboard.dismiss();
        }}
      >
        <View style={styles.page}>
          <View style={{height:'100%'}}>
            <View style={styles.menu}>
              {(searched||filter) && (
                <View style={{flex:0.8,flexDirection:'row',justifyContent:'space-between'}}>
                  {searched && (
                    <View style={styles.searched}>
                      <TextInput 
                        ref={searchRef}
                        style={styles.testoCampo}
                        selectTextOnFocus={true}
                      />
                      <TouchableOpacity onPress={()=> setSearched(false)}>
                        <IconSymbol name={'x.circle'} color={'rgb(0,0,0)'} size={25} style={{marginVertical:'auto'}} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {filter && (
                    <TouchableOpacity style={{...styles.filters, flex: searched ? 1 : 1 }} onPress={()=>openModal()}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>
                        {filterDate && <Text style={styles.singleFilter}>{filterDate.toLocaleDateString()}</Text>}
                        {filterImport && <Text style={styles.singleFilter}>
                          {filterImport[0].toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} - {filterImport[1].toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                        </Text>}
                        {filterOrder && <Text style={styles.singleFilter}>{filterOrder}</Text>}
                        {filterTag && <Text style={{...styles.singleFilter,color:filterTag[1]}}>{filterTag[0]}</Text>}
                      </ScrollView>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.menuButton}>
                <TouchableOpacity style={styles.buttonSearch} onPress={() => {setEditingField('search');setTimeout(() => searchRef.current?.focus(), 50); setSearched(!searched)}}>
                  <IconSymbol name={'magnifyingglass'} color={'rgba(0,0,0,1)'} size={28} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.buttonFilter}  onPress={()=>openModal()}>
                  <IconSymbol name={'slider.horizontal.3'} color={'rgba(0,0,0,1)'} size={28} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:20,paddingTop:0}}>
                {expenses.map((d, i) => (
                    <Spesa
                    key={i}
                    done={d.done ?? false} // boolean
                    description={d.description} // string
                    totalAmount={d.summary.totalAmount}
                    splitBetween={(d.splitBetween ?? []).map(m => m.username)} // array di string
                    creator={(d.creator ?? d.paidBy).username} // string
                    gruppo={d.gruppo ?? ''} // string
                    data={new Date(d.createdAt).toLocaleDateString('it-IT')} // string
                    tagName={d.tagName ?? ''} // string
                    colorTag={d.tagColor ?? '#000'} // string
                    />
                ))}
            </ScrollView>



            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255, 255, 255, 0)','rgba(255, 255, 255, 1)']}
              style={styles.fadeBottom}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>

      <ModalFiltri
        visible={modalVisible}
        fadeAnim={fadeAnim}
        slideAnim={slideAnim}
        onClose={closeModal}
        setFilter={(f:boolean)=>setFilter(f)}
        filterDate={(f:Date)=>(setFilterDate(f))}
        filterImport={(f:[number, number])=>(setFilterImport(f))}
        filterOrder={(f:string)=>(setFilterOrder(f))}
        filterTag={(t:any)=>(setFilterTag(t))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page:{ flex:1, paddingBottom:10 },
  subtitle:{ textAlign:'center', fontSize:16 },
  menu:{ flexDirection:'row', width:'95%', marginBottom:10, justifyContent:'flex-end', alignSelf:'center' },
  searched:{ width:'50%', alignSelf:'center', height:35, marginLeft:5, borderWidth:1, borderColor:'rgba(24, 140, 101, 1)', borderRadius:10, overflow:'hidden', flexDirection:'row', justifyContent:'space-between', paddingVertical:3, paddingHorizontal:5 },
  testoCampo:{ flex:1, fontSize:18, width:'50%' },
  filters:{ borderWidth:1, borderColor:'rgba(24, 140, 101, 1)', borderRadius:10, overflow:'hidden', flexDirection:'row', alignSelf:'center', height:35, paddingHorizontal:10, marginLeft:5 },
  singleFilter:{ fontSize:16, alignSelf:'center', backgroundColor:'rgba(24, 140, 101, 0.2)', borderRadius:5, overflow:'hidden', padding:3 },
  menuButton:{ flexDirection:'row', flex:0.2 },
  buttonSearch:{ alignSelf:'center', padding:4, borderRadius:20, overflow:'hidden' },
  buttonFilter:{ alignSelf:'center', padding:4, borderRadius:20, overflow:'hidden' },
  fadeBottom:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50 },
});
