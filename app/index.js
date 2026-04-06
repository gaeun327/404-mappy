import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, KeyboardAvoidingView, Platform, 
  TouchableWithoutFeedback, Keyboard, ScrollView 
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert("알림", "정보를 모두 입력해주세요.");
    setLoading(true);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email, nickname: nickname || "익명", createdAt: new Date()
        });
        Alert.alert("성공", "회원가입 되었습니다!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace('/home'); 
    } catch (error) {
      Alert.alert("실패", "이메일이나 비밀번호를 확인해주세요.");
    } finally { setLoading(false); }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1, backgroundColor: 'white' }}
      >
        <ScrollView contentContainerStyle={styles.container} bounces={false}>
          <Text style={styles.logo}>📍 Mappy</Text>
          <Text style={styles.subLogo}>{isSignUp ? "회원가입" : "로그인"}</Text>
          
          {isSignUp && (
            <TextInput style={styles.input} placeholder="닉네임" value={nickname} onChangeText={setNickname} />
          )}
          <TextInput style={styles.input} placeholder="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{isSignUp ? "가입하기" : "로그인하기"}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={styles.switchText}>{isSignUp ? "계정이 있나요? 로그인" : "계정이 없나요? 회원가입"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  logo: { fontSize: 40, fontWeight: 'bold', textAlign: 'center', color: '#007AFF' },
  subLogo: { textAlign: 'center', color: '#888', marginBottom: 30 },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 15 },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  switchText: { textAlign: 'center', marginTop: 25, color: '#007AFF' }
});