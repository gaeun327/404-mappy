import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState(
    typeof params.email === 'string' ? params.email : ''
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const requestInFlight = useRef(false);
  const nextSendAt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const timer = setInterval(() => {
      setSecondsLeft(
        Math.max(0, Math.ceil((nextSendAt.current - Date.now()) / 1000))
      );
    }, 1000);

    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  const startCooldown = () => {
    nextSendAt.current = Date.now() + 60000;
    setSecondsLeft(60);
  };

  const handleSend = async () => {
    if (requestInFlight.current || Date.now() < nextSendAt.current) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setError('');

    if (!normalizedEmail) {
      setError('가입할 때 사용한 이메일을 입력해 주세요.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('올바른 이메일 형식으로 입력해 주세요.');
      return;
    }

    Keyboard.dismiss();
    requestInFlight.current = true;
    setSending(true);
    setSentEmail('');

    try {
      auth.languageCode = 'ko';
      await sendPasswordResetEmail(auth, normalizedEmail);

      if (mounted.current) {
        setSentEmail(normalizedEmail);
        startCooldown();
      }
    } catch (err) {
      if (!mounted.current) return;

      switch (err.code) {
        case 'auth/user-not-found':
          // 계정 존재 여부와 관계없이 동일한 안내를 표시합니다.
          setSentEmail(normalizedEmail);
          startCooldown();
          break;

        case 'auth/invalid-email':
        case 'auth/missing-email':
          setError('올바른 이메일 형식으로 입력해 주세요.');
          break;

        case 'auth/network-request-failed':
          setError('인터넷 연결을 확인한 후 다시 시도해 주세요.');
          break;

        case 'auth/too-many-requests':
          setError('요청이 많아 잠시 제한되었어요. 잠시 후 다시 시도해 주세요.');
          startCooldown();
          break;

        default:
          setError('메일 발송 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      requestInFlight.current = false;
      if (mounted.current) setSending(false);
    }
  };

  const returnToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const disabled = sending || secondsLeft > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={returnToLogin}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹ 로그인으로 돌아가기</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.logo}>📍 Mappy</Text>
            <Text style={styles.title}>비밀번호 찾기</Text>
            <Text style={styles.description}>
              가입한 이메일을 입력하면{'\n'}
              비밀번호를 재설정할 수 있는 링크를 보내드려요.
            </Text>

            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="example@email.com"
              placeholderTextColor="#8E8E93"
              accessibilityLabel="가입한 이메일"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError('');
                setSentEmail('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!sending}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />

            {!!error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            {!!sentEmail && (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>메일함을 확인해 주세요</Text>
                <Text style={styles.noticeEmail}>{sentEmail}</Text>
                <Text style={styles.noticeText}>
                  입력한 이메일로 등록된 계정이 있다면 비밀번호 재설정
                  메일이 발송됩니다. 스팸함도 확인해 주세요.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, disabled && styles.buttonDisabled]}
              onPress={handleSend}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled, busy: sending }}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {secondsLeft > 0
                    ? `${secondsLeft}초 후 다시 보내기`
                    : '재설정 메일 보내기'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              메일의 링크에서 새 비밀번호를 설정한 뒤,{'\n'}
              앱으로 돌아와 다시 로그인해 주세요.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 30 },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    marginBottom: 24,
  },
  backText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 36,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: '#636366',
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F2F2F7',
    color: '#1C1C1E',
    padding: 18,
    borderRadius: 15,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  inputError: { borderColor: '#D70015' },
  error: {
    color: '#D70015',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  notice: {
    backgroundColor: '#EEF6FF',
    padding: 16,
    borderRadius: 15,
    marginTop: 16,
  },
  noticeTitle: {
    color: '#005BBB',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 6,
  },
  noticeEmail: { color: '#1C1C1E', fontSize: 14, marginBottom: 8 },
  noticeText: { color: '#48484A', fontSize: 14, lineHeight: 22 },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { backgroundColor: '#93BFF0' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 17 },
  hint: {
    color: '#636366',
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 20,
  },
});