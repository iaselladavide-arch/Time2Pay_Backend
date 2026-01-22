import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';

import ExpensesPage from './expenses';
import IndexPage from './index';
import ProfilePage from './profile';

export default function TabLayout() {
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(1); // 1 = Home iniziale
  const colorScheme = useColorScheme();

  const pages = [
    { component: <ExpensesPage active={activeIndex === 0} />, title: 'Expenses', icon: ['dollarsign.circle','dollarsign.circle.fill'] },

    { component: <IndexPage active={activeIndex === 1} />, title:'Home', icon: ['house','house.fill'] },

    { component: <ProfilePage />, title:'Profile' , icon: ['person','person.fill'] },
  ];

  return (
    <View style={{ flex: 1 }}>
      <PagerView
        style={{ flex: 1 }}
        initialPage={1}
        ref={pagerRef}
        onPageSelected={e => setActiveIndex(e.nativeEvent.position)}
      >
        {pages.map((p, i) => (
          <View key={i} style={{ flex: 1 }}>
            {p.component}
          </View>
        ))}
      </PagerView>

      <View style={styles.tabBar}>
        {pages.map((p, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              setActiveIndex(i);
              pagerRef.current?.setPage(i);
            }}
            style={{ padding:10, justifyContent:'center', aspectRatio:1, marginHorizontal:0 }}
          >
            <IconSymbol
              style={styles.icon}
              name={activeIndex === i ? p.icon[1] as any : p.icon[0] as any}
              size={30}
              color={activeIndex === i ? 'rgba(24, 140, 102, 1)' : 'gray'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 80,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#000000ff',
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  icon: {
    alignSelf: 'center',
  },
});
