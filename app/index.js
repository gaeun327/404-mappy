import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, getDocFromServer } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { useRouter, useFocusEffect } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [incompleteEmail, setIncompleteEmail] = useState('');

  const loginRequest = useRef(false);

  // 회원가입 화면에서는 이 자동 이동 처리가 실행되지 않습니다.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let version = 0;

      setLoading(true);

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        const request = ++version;

        if (loginRequest.current) return;

        try {
          if (!user) {
            if (active) setIncompleteEmail('');
            return;
          }

          const snap = await getDocFromServer(
            doc(db, 'users', user.uid)
          );

          if (!active || request !== version || loginRequest.current) {
            return;
          }

          if (snap.exists()) {
            router.replace('/home');
          } else {
            setIncompleteEmail(user.email ?? '');
          }
        } catch {
          // 자동 확인 실패 시 로그인 화면에서 다시 시도합니다.
        } finally {
          if (active && request === version) {
            setLoading(false);
          }
        }
      });

      return () => {
        active = false;
        unsubscribe();
      };
    }, [router])
  );

  const continueSignup = (value) => {
    router.push({
      pathname: '/signup',
      params: { email: value },
    });
  };

  const handleLogin = async () => {
    if (loginRequest.current) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return Alert.alert(
        '알림',
        '이메일과 비밀번호를 입력해 주세요.'
      );
    }

    loginRequest.current = true;
    setBtnLoading(true);

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      const snap = await getDocFromServer(
        doc(db, 'users', result.user.uid)
      );

      if (!snap.exists()) {
        setIncompleteEmail(normalizedEmail);

        Alert.alert(
          '가입 정보 미완료',
          '계정은 만들어졌지만 가입 정보가 저장되지 않았어요. 같은 이메일과 비밀번호로 가입을 이어서 완료해 주세요.',
          [
            { text: '닫기', style: 'cancel' },
            {
              text: '가입 이어서 하기',
              onPress: () => continueSignup(normalizedEmail),
            },
          ]
        );

        return;
      }

      router.replace('/home');
    } catch (error) {
      let message = '이메일이나 비밀번호를 확인해 주세요.';

      if (
        ['auth/network-request-failed', 'unavailable'].includes(
          error.code
        )
      ) {
        message = '인터넷 연결을 확인한 후 다시 시도해 주세요.';
      } else if (error.code === 'permission-denied') {
        message =
          '사용자 정보를 불러올 권한이 없어요. 관리자에게 문의해 주세요.';
      } else if (error.code === 'auth/too-many-requests') {
        message = '요청이 많아요. 잠시 후 다시 시도해 주세요.';
      } else if (error.code === 'auth/user-disabled') {
        message = '사용이 중지된 계정입니다.';
      }

      Alert.alert('로그인 실패', message);
    } finally {
      loginRequest.current = false;
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
            {!!incompleteEmail && (
              <TouchableOpacity
                style={styles.notice}
                disabled={btnLoading}
                onPress={() => continueSignup(incompleteEmail)}
              >
                <Text style={styles.noticeText}>
                  이전 가입이 완료되지 않았어요. 눌러서 이어서 가입해
                  주세요.
                </Text>
              </TouchableOpacity>
            )}

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
              style={styles.switchBtn}
              disabled={btnLoading}
              onPress={() => continueSignup(email.trim())}
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
  notice: {
    backgroundColor: '#EEF6FF', padding: 14,
    borderRadius: 12, marginBottom: 16,
  },
  noticeText: { color: '#005BBB', fontSize: 14, lineHeight: 21 },
  screen: { flex: 1, backgroundColor: 'white' },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  container: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  headerArea: { marginBottom: 40 },
  logo: {
    fontSize: 42, fontWeight: '900', textAlign: 'center',
    color: '#007AFF', letterSpacing: -1,
  },
  subLogo: {
    textAlign: 'center', color: '#8E8E93', marginTop: 10, fontSize: 16,
  },
  inputArea: { width: '100%' },
  input: {
    backgroundColor: '#F2F2F7', padding: 18,
    borderRadius: 15, marginBottom: 12, fontSize: 15,
  },
  button: {
    backgroundColor: '#007AFF', padding: 18, borderRadius: 15,
    alignItems: 'center', marginTop: 10, elevation: 2,
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 17 },
  forgotBtn: { marginTop: 12, padding: 10, alignItems: 'center' },
  forgotText: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  switchBtn: { marginTop: 15, padding: 10 },
  switchText: { textAlign: 'center', color: '#8E8E93', fontSize: 14 },
});