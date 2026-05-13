import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  TouchableWithoutFeedback, Keyboard, ScrollView
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 O/0/I/1 제외
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export default function SignUpScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkEmail = async () => {
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) return Alert.alert("형식 오류", "올바른 이메일 형식이 아닙니다.");
    try {
      setLoading(true);
      const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        Alert.alert("중복", "이미 사용 중인 이메일입니다.");
        setIsEmailChecked(false);
      } else {
        Alert.alert("확인", "사용 가능한 이메일입니다.");
        setIsEmailChecked(true);
      }
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  const checkNickname = async () => {
    if (nickname.length < 2) return Alert.alert("알림", "닉네임은 2글자 이상이어야 합니다.");
    try {
      setLoading(true);
      const q = query(collection(db, "users"), where("nickname", "==", nickname));
      const snap = await getDocs(q);
      if (!snap.empty) {
        Alert.alert("중복", "이미 존재하는 닉네임입니다.");
        setIsNicknameChecked(false);
      } else {
        Alert.alert("확인", "사용 가능한 닉네임입니다.");
        setIsNicknameChecked(true);
      }
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!isEmailChecked || !isNicknameChecked)
      return Alert.alert("미완료", "이메일과 닉네임 중복 확인을 해주세요.");
    const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!pwRegex.test(password))
      return Alert.alert("비밀번호 오류", "비밀번호는 영문과 숫자를 포함하여 6자 이상이어야 합니다.");

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: nickname });
      await setDoc(doc(db, "users", user.uid), {
        email: email.toLowerCase(),
        nickname,
        createdAt: new Date(),
        points: 0,
        level: "새싹 탐험가 🌱",
        inviteCode: generateInviteCode(),
        friends: [],
      });
      Alert.alert("환영합니다!", `${nickname}님, 탐험을 시작해보세요!`);
      router.replace('/home');
    } catch (e) {
      Alert.alert("가입 실패", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'white' }}
      >
        <ScrollView contentContainerStyle={styles.container} bounces={false}>
          <View style={styles.headerArea}>
            <Text style={styles.logo}>📍 Mappy</Text>
            <Text style={styles.subLogo}>새로운 탐험의 시작</Text>
          </View>

          <View style={styles.inputArea}>
            {/* 이메일 */}
            <View style={styles.rowWrap}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="이메일"
                value={email}
                onChangeText={(t) => { setEmail(t); setIsEmailChecked(false); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                style={[styles.checkBtn, isEmailChecked && styles.checkBtnDone]}
                onPress={checkEmail}
                disabled={loading}
              >
                <Text style={styles.checkBtnText}>{isEmailChecked ? "확인됨 ✓" : "중복 확인"}</Text>
              </TouchableOpacity>
            </View>

            {/* 닉네임 */}
            <View style={styles.rowWrap}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="닉네임"
                value={nickname}
                onChangeText={(t) => { setNickname(t); setIsNicknameChecked(false); }}
              />
              <TouchableOpacity
                style={[styles.checkBtn, isNicknameChecked && styles.checkBtnDone]}
                onPress={checkNickname}
                disabled={loading}
              >
                <Text style={styles.checkBtnText}>{isNicknameChecked ? "확인됨 ✓" : "중복 확인"}</Text>
              </TouchableOpacity>
            </View>

            {/* 비밀번호 */}
            <TextInput
              style={styles.input}
              placeholder="비밀번호 (영문+숫자 6자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
            />

            <TouchableOpacity
              style={[styles.button, (!isEmailChecked || !isNicknameChecked) && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading || !isEmailChecked || !isNicknameChecked}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.buttonText}>탐험 시작하기</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.switchBtn}>
              <Text style={styles.switchText}>이미 계정이 있으신가요? 로그인</Text>
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
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { backgroundColor: '#F2F2F7', padding: 18, borderRadius: 15, marginBottom: 12, fontSize: 15 },
  inputFlex: { flex: 1, marginBottom: 0 },
  checkBtn: { backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 18, borderRadius: 15 },
  checkBtnDone: { backgroundColor: '#34C759' },
  checkBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  button: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, elevation: 2 },
  buttonDisabled: { backgroundColor: '#C7C7CC' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 17 },
  switchBtn: { marginTop: 25, padding: 10 },
  switchText: { textAlign: 'center', color: '#8E8E93', fontSize: 14 },
});