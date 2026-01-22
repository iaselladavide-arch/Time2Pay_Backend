// ProfileImageModal.js
import { router } from "expo-router";
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "./ui/icon-symbol";

type Props = {
    description: string;
    done: any;
    totalAmount: number;
    splitBetween: any;
    creator: string;
    gruppo: string;
    data?: string;
    tagName?: string;
    colorTag?: string;
};

export default function Spesa({description, done, totalAmount, splitBetween, creator, gruppo, data} : Props) {
    return (
        <TouchableOpacity style={styles.spesa} onPress={() =>router.push({
                pathname: '/pages/singleExpense',
                params: {
                description,
                totalAmount,
                gruppo,
                creator,
                splitBetween: JSON.stringify(splitBetween),
                done: String(done),
                data,
                },
            })}>
            <ImageBackground
                source={done ? require('../assets/images/done.png') : undefined}
                style={{...styles.background, backgroundColor:done?'rgba(24, 140, 101, 0.2)':''}}
                imageStyle={{ borderRadius: 10, opacity:0.5 }}
            >
                <View style={{flexDirection:'row',justifyContent:'space-between',}}>
                    <Text style={[styles.spesaSingola, { color: done ? 'rgba(21,98,16,1)' : 'rgba(255,0,0,1)' }]}>
                    {(totalAmount/splitBetween.length).toLocaleString('it-IT', {
                        style: 'currency',
                        currency: 'EUR',
                    })}
                    </Text>

                    <View style={{ width: '90%' }}>
                        <View style={styles.dettagliSpesa}>
                            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                                <Text style={styles.titoloSpesa}>{description}</Text>
                                {data&&<Text style={styles.dataSpesa}>{data}</Text>}
                            </View>
                            
                            <View style={{marginBottom:20,flexDirection:'row',justifyContent:'space-between'}}>
                                <Text style={styles.gruppoSpesa}>{gruppo}</Text>
                            </View>
                        </View>
                    </View>

                    <IconSymbol
                        name={'chevron.right'}
                        color={'rgb(0,0,0)'}
                        style={{ alignSelf:'center', marginRight:20 }}
                    />

                </View>
            </ImageBackground>
            </TouchableOpacity>

    );
}

const styles = StyleSheet.create({
    spesa:{
        marginHorizontal:30,
        marginVertical:15,
        borderRadius:10,
        borderWidth:2,
        borderColor:'rgba(24, 140, 101, 1)',
    },
    background:{},
    dettagliSpesa:{
        width:'100%',
        padding:15,
    },
    titoloSpesa:{
        fontSize:22,
        fontWeight:"600",
        marginBottom:5,
        width:'70%',
    },
    gruppoSpesa:{
        fontSize:14,
        marginVertical:0,
        width:'70%',
    },
    tagSpesa:{
        backgroundColor:'rgba(255, 255, 255, 1)',
        width:75,
        padding:5,
        borderWidth:0.5,
        borderRadius:5,
    },
    dataSpesa:{
        fontSize:14,
        fontWeight:"500",
        marginVertical:0,
    },
    spesaSingola:{
        position:'absolute',
        bottom:5,
        marginHorizontal:15,
        left:0,
        right:0,
        fontSize:20,
        marginTop:20,
        fontWeight:"600",
        textAlign:'center'
    },
})
