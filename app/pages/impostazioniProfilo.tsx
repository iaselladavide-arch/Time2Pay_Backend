import { IconSymbol } from '@/components/ui/icon-symbol';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ImpostazioniProfilo() {
    const [accountVisible, setAccountVisible] = useState(false);
    const [notificationVisible, setNotificationVisible] = useState(false);
    const [notifications, setNotifications] = useState(true);

    const accountAnim = useRef(new Animated.Value(0)).current;

    const toggleAccount = () => {
        if (accountVisible) {
            Animated.timing(accountAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
            }).start(() => setAccountVisible(false));
        } else {
            setAccountVisible(true);
            Animated.timing(accountAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
            }).start();
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            
            <View style={styles.title}>
                <Text style={styles.titleText}>Settings</Text>
                <TouchableOpacity style={styles.backButton} onPress={()=>router.push('..')}>
                    <IconSymbol name={'chevron.left'} color={'rgb(0,0,0)'}></IconSymbol>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.page}>
                <TouchableOpacity style={styles.titoloButton} onPress={()=>{toggleAccount()/* setAccountVisible(!accountVisible) */}}>
                    <Text style={{...styles.titolo, color:accountVisible?'rgba(24, 140, 101, 1)':'', fontWeight: accountVisible?600:500,}}>Account</Text>
                    <IconSymbol name={!accountVisible?'chevron.right':'chevron.down'} color={'rgb(0,0,0)'}></IconSymbol>
                </TouchableOpacity>

                <Animated.View
                style={{
                    overflow: 'hidden',
                    opacity: accountAnim,
                    height: accountAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 375], // 🔧 regola in base al contenuto
                    }),
                    borderBottomWidth: 0.5,
                    marginHorizontal: 30,
                }}
                >
                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>E-mail</Text>
                        <View style={styles.campo}>
                            <TextInput style={styles.testoCampo} value='valentinacasucci@gmail.com'/>
                            <IconSymbol name={'pencil'} color={'rgb(0,0,0)'} size={20} style={{marginVertical:'auto', marginRight:20,}}></IconSymbol>
                        </View>
                    </View>
                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>Username</Text>
                        <View style={styles.campo}>
                            <TextInput style={styles.testoCampo} value='valentinacasucci'/>
                            <IconSymbol name={'pencil'} color={'rgb(0,0,0)'} size={20} style={{marginVertical:'auto', marginRight:20,}}></IconSymbol>
                        </View>
                    </View>
                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>Nome</Text>
                        <View style={styles.campo}>
                            <TextInput style={styles.testoCampo} value='Valentina'/>
                            <IconSymbol name={'pencil'} color={'rgb(0,0,0)'} size={20} style={{marginVertical:'auto', marginRight:20,}}></IconSymbol>
                        </View>
                    </View>
                    <View style={styles.titoloTesto}>
                        <Text style={styles.testo}>Cognome</Text>
                        <View style={styles.campo}>
                            <TextInput style={styles.testoCampo} value='Casucci'/>
                            <IconSymbol name={'pencil'} color={'rgb(0,0,0)'} size={20} style={{marginVertical:'auto', marginRight:20,}}></IconSymbol>
                        </View>
                    </View>
                </Animated.View>

                <TouchableOpacity style={styles.titoloButton} onPress={()=>setNotificationVisible(!notificationVisible)}>
                    <Text style={{...styles.titolo, color:notificationVisible?'rgba(24, 140, 101, 1)':'', fontWeight: notificationVisible?600:500,}}>Notification</Text>
                    <IconSymbol name={!notificationVisible?'chevron.right':'chevron.down'} color={'rgb(0,0,0)'}></IconSymbol>
                </TouchableOpacity>
                {notificationVisible && <View>
                    <Text>Info</Text>
                </View>}

                <View style={styles.titoloButton}>
                    <Text style={styles.titolo}>Notification</Text>
                    <Switch
                        value={notifications}
                        onValueChange={setNotifications}
                        trackColor={{ false: '#6b0505ff', true: 'rgba(152, 255, 214, 1)' }}
                        thumbColor={notifications ? 'rgba(24, 140, 101, 1)' : '#ffffffff'}
                    />
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    
    title:{
        height:120,
        paddingTop:70,
        flexDirection:'row',
        justifyContent:'center',
        borderBottomWidth:0.5,
        position:'relative',
    },
    backButton:{
        zIndex:2,
        marginTop:70,
        position:'absolute',
        top:-5,
        left:5,
        padding:10,
    },
    titleText:{
        fontSize:26,
        fontWeight:500,
        paddingBottom:10,
        color:'rgba(24, 140, 101, 1)',
    },
    page:{
        flex:1,
        backgroundColor:'rgba(255, 255, 255, 1)',
    },
    titoloButton:{
        flexDirection:'row',
        justifyContent:'space-between',
        paddingHorizontal:20,
        paddingTop:20,
        paddingBottom:20,
    },
    titolo:{
        fontSize:20,
        fontWeight:500,
    },
    titoloTesto:{
        marginBottom:10,
    },
    campo:{
        flexDirection:'row',
        justifyContent:'space-between',
    },
    testo:{
        fontSize:18,
        marginVertical:'auto',
    },
    testoCampo:{
        marginLeft:'10%',
        fontSize:20,
        fontWeight:500,
        marginVertical:'auto',
        paddingVertical:20,
        width:'70%',
    },
});
