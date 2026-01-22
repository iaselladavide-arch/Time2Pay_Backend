import Spesa from '@/components/spesa';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';


const data = [
    {description: 'Hotel 2 notti', gruppo:'Weekend a Roma', totalAmount: 18, creator: 'Casucci Valentina', splitBetween: ['Dalla Valle Marco','Iasella Davide'], done:false},
    {description: 'Hotel 4 notti', gruppo:'Weekend a Milano', totalAmount: 80.5, creator: 'me', splitBetween: ['me','Iasella Davide'], done: false},
    {description: 'Hotel 1 notte', gruppo:'Weekend a Valencia', totalAmount: 1, creator: 'me', splitBetween: ['me', 'Casucci Valentina'], done: false},
    {description: 'Hotel 2 notti', gruppo:'Weekend a Roma', totalAmount: 18, creator: 'Casucci Valentina', splitBetween: ['Dalla Valle Marco','Iasella Davide'], done: true},
    {description: 'Hotel 4 notti', gruppo:'Weekend a Milano', totalAmount: 80.5, creator: 'me', splitBetween: ['me','Iasella Davide'], done: false},
    {description: 'Hotel 1 notte', gruppo:'Weekend a Valencia', totalAmount: 1, creator: 'me', splitBetween: ['me', 'Casucci Valentina'], done: false},
    {description: 'Hotel 2 notti', gruppo:'Weekend a Roma', totalAmount: 18, creator: 'Casucci Valentina', splitBetween: ['Dalla Valle Marco','Iasella Davide'], done: true},
]

export default function History() {

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.page}>
                <View style={{height:'100%',}}>
                    <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:20}}>
                        <Text style={styles.subtitle}>Last week</Text>
                        {data.slice(0,3).map((d, i)=>(<Spesa
                            key={i}
                            done={d.done}
                            description={d.description}
                            totalAmount={d.totalAmount}
                            splitBetween={d.splitBetween}
                            creator={d.creator}
                            gruppo={d.gruppo}
                            data={(new Date().toLocaleDateString('it-IT'))}
                        />))}
                        <Text style={styles.subtitle}>Last month</Text>
                        {data.slice(3).map((d, i)=>(<Spesa
                            key={i}
                            done={d.done}
                            description={d.description}
                            totalAmount={d.totalAmount}
                            splitBetween={d.splitBetween}
                            creator={d.creator}
                            gruppo={d.gruppo}
                            data={(new Date().toLocaleDateString('it-IT'))}
                        />))}
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
    
    page:{
        flex:1,
        paddingTop:10,
        paddingBottom:10,
    },
    subtitle:{
        textAlign:'center',
        fontSize:16,
    },
    fadeBottom:{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 50,
    },
});
