import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, KeyboardAvoidingView, Platform, 
  TouchableWithoutFeedback, Keyboard, ScrollView 
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태 true로 설정
  const [btnLoading, setBtnLoading] = useState(false);

  // 🔥 [핵심] 저장 시 로그아웃 방지 로직
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 이미 로그인된 상태라면 바로 홈으로 보냄
        router.replace('/home');
      }
      setLoading(false); // 상태 확인 끝나면 로딩 해제
    });
    return unsubscribe;
  }, []);

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert("알림", "정보를 모두 입력해주세요.");
    if (isSignUp && !nickname) return Alert.alert("알림", "닉네임을 입력해주세요.");
    
    setBtnLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Firestore에 유저 정보 저장 (기본 등급: 새싹 탐험가)
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email, 
          nickname: nickname, 
          level: "새싹 탐험가 🌱", 
          points: 0,
          createdAt: new Date()
        });
        Alert.alert("성공", `${nickname}님, 환영합니다!`);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // 성공 시 이동 (onAuthStateChanged가 처리하지만 명시적으로 추가)
      router.replace('/home'); 
    } catch (error) {
      console.log(error.code);
      let message = "이메일이나 비밀번호를 확인해주세요.";
      if (error.code === 'auth/email-already-in-use') message = "이미 사용 중인 이메일입니다.";
      if (error.code === 'auth/weak-password') message = "비밀번호는 6자리 이상이어야 합니다.";
      Alert.alert("알림", message);
    } finally { setBtnLoading(false); }
  };

  if (loading) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1, backgroundColor: 'white' }}
      >
        <ScrollView contentContainerStyle={styles.container} bounces={false}>
          <View style={styles.headerArea}>
            <Text style={styles.logo}>📍 Mappy</Text>
            <Text style={styles.subLogo}>
              {isSignUp ? "새로운 탐험의 시작" : "우리 동네 숨은 스팟 찾기"}
            </Text>
          </View>
          
          <View style={styles.inputArea}>
            {isSignUp && (
              <TextInput 
                style={styles.input} 
                placeholder="닉네임 (예: 로컬맛집왕)" 
                value={nickname} 
                onChangeText={setNickname} 
              />
            )}
            <TextInput 
              style={styles.input} 
              placeholder="이메일" 
              value={email} 
              onChangeText={setEmail} 
              autoCapitalize="none" 
              keyboardType="email-address" 
            />
            <TextInput 
              style={styles.input} 
              placeholder="비밀번호" 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
            />

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: isSignUp ? '#34C759' : '#007AFF' }]} 
              onPress={handleAuth} 
              disabled={btnLoading}
            >
              {btnLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>{isSignUp ? "탐험 시작하기" : "로그인"}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                {isSignUp ? "이미 계정이 있으신가요? 로그인" : "처음이신가요? 3초만에 회원가입"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  headerArea: { marginBottom: 40 },
  logo: { fontSize: 42, fontWeight: '900', textAlign: 'center', color: '#007AFF', letterSpacing: -1 },
  subLogo: { textAlign: 'center', color: '#8E8E93', marginTop: 10, fontSize: 16 },
  inputArea: { width: '100%' },
  input: { backgroundColor: '#F2F2F7', padding: 18, borderRadius: 15, marginBottom: 12, fontSize: 15 },
  button: { padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, elevation: 2, shadowOpacity: 0.1 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 17 },
  switchBtn: { marginTop: 25, padding: 10 },
  switchText: { textAlign: 'center', color: '#8E8E93', fontSize: 14 }
});