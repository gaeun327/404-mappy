import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ScrollView,
} from 'react-native';
import { auth } from '../firebaseConfig';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
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
    if (btnLoading) return;

    if (!email.trim() || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setBtnLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );
      router.replace('/home');
    } catch (error) {
      let message = '이메일이나 비밀번호를 확인해주세요.';

      if (error.code === 'auth/invalid-email') {
        message = '올바른 이메일 형식이 아닙니다.';
      } else if (error.code === 'auth/network-request-failed') {
        message = '인터넷 연결을 확인해주세요.';
      } else if (error.code === 'auth/too-many-requests') {
        message = '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.';
      }

      Alert.alert('로그인 실패', message);
    } finally {
      setBtnLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
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
              autoCorrect={false}
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
              {btnLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>로그인</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotBtn}
              disabled={btnLoading}
              onPress={() =>
                router.push({
                  pathname: '/forgotpassword',
                  params: { email: email.trim() },
                })
              }
            >
              <Text style={styles.forgotText}>
                비밀번호를 잊으셨나요?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/signup')}
              style={styles.switchBtn}
            >
              <Text style={styles.switchText}>
                처음이신가요? 회원가입
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'white' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
  },
  headerArea: { marginBottom: 40 },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    textAlign: 'center',
    color: '#007AFF',
    letterSpacing: -1,
  },
  subLogo: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 10,
    fontSize: 16,
  },
  inputArea: { width: '100%' },
  input: {
    backgroundColor: '#F2F2F7',
    padding: 18,
    borderRadius: 15,
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 17,
  },
  forgotBtn: {
    marginTop: 12,
    padding: 10,
    alignItems: 'center',
  },
  forgotText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  switchBtn: { marginTop: 15, padding: 10 },
  switchText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 14,
  },
});