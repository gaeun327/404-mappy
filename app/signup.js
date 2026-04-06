import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SignUpScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  
  // 중복 확인 상태
  const [isEmailChecked, setIsEmailChecked] = useState(false);
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. 이메일 중복 확인 (형식 검사 포함)
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
        Alert.alert("가능", "사용 가능한 이메일입니다.");
        setIsEmailChecked(true);
      }
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  // 2. 닉네임 중복 확인
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
        Alert.alert("가능", "사용 가능한 닉네임입니다.");
        setIsNicknameChecked(true);
      }
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  // 3. 최종 회원가입 로직
  const handleSignUp = async () => {
    // 유효성 검사
    if (!isEmailChecked || !isNicknameChecked) return Alert.alert("미완료", "이메일과 닉네임 중복 확인을 해주세요.");
    
    // 비밀번호 규칙: 숫자 + 영어 포함 6자 이상
    const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!pwRegex.test(password)) {
      return Alert.alert("비밀번호 오류", "비밀번호는 영문과 숫자를 포함하여 6자 이상이어야 합니다.");
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Firebase Auth 프로필에 닉네임 저장
      await updateProfile(user, { displayName: nickname });

      // Firestore의 users 컬렉션에 추가 정보 저장 (나중에 중복 체크용)
      await setDoc(doc(db, "users", user.uid), {
        email: email.toLowerCase(),
        nickname: nickname,
        createdAt: new Date(),
        points: 0,
        level: "맛집 초보"
      });

      Alert.alert("환영합니다!", `${nickname}님, 회원가입이 완료되었습니다.`);
      router.replace('/home');
    } catch (e) {
      Alert.alert("가입 실패", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>새로운 미식가 등록</Text>

      {/* 이메일 입력 */}
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="이메일 주소" 
          value={email} 
          onChangeText={(text) => { setEmail(text); setIsEmailChecked(false); }} 
        />
        <TouchableOpacity style={styles.checkBtn} onPress={checkEmail}>
          <Text style={styles.checkBtnText}>{isEmailChecked ? "확인됨" : "중복 확인"}</Text>
        </TouchableOpacity>
      </View>

      {/* 닉네임 입력 */}
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="닉네임" 
          value={nickname} 
          onChangeText={(text) => { setNickname(text); setIsNicknameChecked(false); }} 
        />
        <TouchableOpacity style={styles.checkBtn} onPress={checkNickname}>
          <Text style={styles.checkBtnText}>{isNicknameChecked ? "확인됨" : "중복 확인"}</Text>
        </TouchableOpacity>
      </View>

      {/* 비밀번호 입력 */}
      <TextInput 
        style={[styles.input, { width: '100%' }]} 
        placeholder="비밀번호 (영문+숫자 6자 이상)" 
        secureTextEntry 
        value={password} 
        onChangeText={setPassword} 
      />

      <TouchableOpacity 
        style={[styles.signUpBtn, (loading || !isEmailChecked || !isNicknameChecked) && { backgroundColor: '#ccc' }]} 
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.signUpBtnText}>가입하기</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
        <Text style={{color: '#888'}}>이미 계정이 있으신가요? 로그인</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 40 },
  inputContainer: { flexDirection: 'row', width: '100%', marginBottom: 15, gap: 10 },
  input: { flex: 1, height: 50, backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 15 },
  checkBtn: { width: 90, backgroundColor: '#333', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  checkBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  signUpBtn: { width: '100%', height: 55, backgroundColor: '#007AFF', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  signUpBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});