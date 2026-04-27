import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ScrollView
} from 'react-native';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/home');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");

    setBtnLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/home');
    } catch (error) {
      let message = "이메일이나 비밀번호를 확인해주세요.";
      if (error.code === 'auth/user-not-found') message = "존재하지 않는 계정입니다.";
      if (error.code === 'auth/wrong-password') message = "비밀번호가 틀렸습니다.";
      if (error.code === 'auth/invalid-email') message = "올바른 이메일 형식이 아닙니다.";
      Alert.alert("로그인 실패", message);
    } finally {
      setBtnLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
            <Text style={styles.subLogo}>우리 동네 숨은 스팟 찾기</Text>
          </View>

          <View style={styles.inputArea}>
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
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={btnLoading}
            >
              {btnLoading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.buttonText}>로그인</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/signup')}
              style={styles.switchBtn}
            >
              <Text style={styles.switchText}>처음이신가요? 회원가입</Text>
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
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, elevation: 2 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 17 },
  switchBtn: { marginTop: 25, padding: 10 },
  switchText: { textAlign: 'center', color: '#8E8E93', fontSize: 14 },
});