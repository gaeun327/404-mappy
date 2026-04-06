import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // 3초 뒤에 로그인(index)으로 넘어가게 설정
    const timer = setTimeout(() => {
      router.replace('/');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>MAPPY</Text>
      <Text style={styles.subText}>지인들과 함께하는 지도</Text>
      <Text style={{color: 'white', marginTop: 50}}>로딩 중...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#007AFF', // 쨍한 파란색!
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  logoText: { 
    fontSize: 70, // 글씨 더 크게!
    fontWeight: 'bold', 
    color: 'white',
  },
  subText: { 
    fontSize: 20, 
    color: 'white', 
    marginTop: 10 
  },
});