import { IconSymbol } from '@/components/ui/icon-symbol';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { useState } from "react";
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import DateTimePickerModal from 'react-native-modal-datetime-picker';

type Props = {
  visible: boolean;
  fadeAnim: any;
  slideAnim: any;
  onClose: () => void;
  setFilter: (v:boolean)=>void;
  filterDate: (v:any)=>void;
  filterImport: (v:any)=>void;
  filterOrder: (v:any)=>void;
  filterTag: (v:any)=>void;
};

export default function ModalFiltri({
  visible, fadeAnim, slideAnim, onClose,
  setFilter, filterDate, filterImport, filterOrder, filterTag
}: Props) {

  const [date, setDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [ordineSelezionato, setOrdineSelezionato] = useState('Seleziona');
  const [visibleMenu, setVisibleMenu] = useState(false);
  const [tagSelezionato, setTagSelezionato] = useState<[string,string]>(['Tutti','rgba(0,0,0,1)']);
  const [visibleTags, setVisibleTags] = useState(false);
  const [importoRange, setImportoRange] = useState<[number, number] | null>(null);
  const [showImport, setShowImport] = useState(false);

  const options = ['Seleziona','Data (dal più recente)','Data (dal meno recente)','Importo (dal più alto)','Importo (dal più basso)','Gruppo (A-Z)','Gruppo (Z-A)'];
  const tags = [
    {name:'Tutti',color:'rgba(0,0,0,1)'},
    {name:'Impegni',color:'rgba(150,8,126,1)'},
    {name:'Viaggi',color:'rgba(255,0,0,1)'},
    {name:'Scuola',color:'rgba(17,215,30,1)'},
  ];

  const crea = () => {
    filterDate(date);
    filterImport(importoRange);
    filterOrder(ordineSelezionato !== 'Seleziona' ? ordineSelezionato : null);
    filterTag(tagSelezionato[0] !== 'Tutti' ? tagSelezionato : null);
    setFilter(!!(date || importoRange || ordineSelezionato !== 'Seleziona' || tagSelezionato[0] !== 'Tutti'));
    onClose();
  };

  const clear = () => {
    setFilter(false);
    setDate(null);
    setTagSelezionato(['Tutti','rgba(0,0,0,1)']);
    setOrdineSelezionato('Seleziona');
    setShowImport(false);
    setImportoRange(null);
  };

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={{flex:1}}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.sfondoChiusura,{opacity:fadeAnim}]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.visibile,{transform:[{translateY:slideAnim}]}]}>

          <View style={styles.title}>
            <Text style={styles.titleText}>Filtri</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <IconSymbol name="chevron.down" color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.date}>
            <TouchableOpacity style={styles.dateButton} onPress={()=>setShowPicker(true)}>
              <Text style={styles.textDateButton}>Data</Text>
              <IconSymbol name="calendar" color="rgb(0,0,0)" />
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePickerModal
              isVisible={showPicker}
              mode="date"
              onConfirm={(d)=>{setDate(d);setShowPicker(false);}}
              onCancel={()=>setShowPicker(false)}
            />
          )}

          <View style={styles.tag}>
            <Text style={styles.textTag}>Tag</Text>
            <TouchableOpacity style={styles.buttonTag} onPress={()=>setVisibleTags(!visibleTags)}>
              <Text style={{color:tagSelezionato[1]}}>{tagSelezionato[0]}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.import}>
            <TouchableOpacity style={styles.detailImport} onPress={()=>{setShowImport(!showImport);setImportoRange(showImport?null:[0,500]);}}>
              <Text style={styles.textImport}>Importo</Text>
              {showImport && importoRange && <Text style={styles.selectedImport}>{importoRange[0]}€ - {importoRange[1]}€</Text>}
            </TouchableOpacity>

            {showImport && (
              <MultiSlider
                values={importoRange || [0,500]}
                min={0}
                max={500}
                step={10}
                sliderLength={250}
                onValuesChange={(v)=>setImportoRange([v[0],v[1]])}
                selectedStyle={{backgroundColor:'rgba(24,140,101,1)'}}
                unselectedStyle={{backgroundColor:'#ccc'}}
                markerStyle={styles.markerStyle}
                containerStyle={{height:30,alignSelf:'center'}}
              />
            )}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity onPress={clear} style={styles.buttonClear}>
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={crea} style={styles.buttonCrea}>
              <Text style={styles.buttonText}>Search</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sfondoChiusura:{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'rgba(0,0,0,0.4)'},
  visibile:{position:'absolute',left:0,right:0,bottom:0,top:50,marginHorizontal:10,backgroundColor:'#fff',borderTopLeftRadius:30,borderTopRightRadius:30},
  title:{paddingTop:30,flexDirection:'row',justifyContent:'center',borderBottomWidth:0.5},
  titleText:{color:'rgba(24,140,101,1)',fontSize:26,fontWeight:'500'},
  closeButton:{position:'absolute',right:15,top:30,padding:5},
  date:{margin:20,padding:5,borderWidth:0.5,borderRadius:10},
  dateButton:{flexDirection:'row',justifyContent:'space-between',padding:15},
  textDateButton:{fontSize:18},
  tag:{margin:20,borderWidth:0.5,borderRadius:10,flexDirection:'row',justifyContent:'space-between'},
  textTag:{padding:20,fontSize:18},
  buttonTag:{width:180,borderWidth:2,borderColor:'rgba(24,140,101,1)',margin:10,alignItems:'center',borderRadius:10,padding:10},
  import:{margin:20,padding:5,borderWidth:0.5,borderRadius:10},
  detailImport:{flexDirection:'row',justifyContent:'space-between',padding:15},
  textImport:{fontSize:18},
  selectedImport:{fontSize:18,fontWeight:'600'},
  markerStyle:{backgroundColor:'rgba(24,140,101,1)',height:20,width:20,borderRadius:10},
  buttons:{flexDirection:'row',justifyContent:'space-around',marginVertical:30},
  buttonClear:{width:120,borderWidth:2,borderColor:'rgba(24,140,101,1)',padding:15,borderRadius:5,alignItems:'center'},
  buttonCrea:{width:120,borderWidth:2,borderColor:'rgba(24,140,101,1)',padding:15,borderRadius:5,alignItems:'center'},
  buttonText:{fontSize:20}
});
