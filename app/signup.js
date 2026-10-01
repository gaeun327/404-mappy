import React, { useRef, useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { auth, db } from '../firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  getDocFromServer,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

async function generateUniqueInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const snap = await getDocs(
      query(collection(db, 'users'), where('inviteCode', '==', code))
    );

    if (snap.empty) return code;
  }

  throw new Error('초대 코드 생성 실패');
}

function errorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-email':
      return '올바른 이메일을 입력해 주세요.';

    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return '비밀번호가 보안 기준에 맞지 않아요. 더 긴 영문·숫자 조합을 사용해 주세요.';

    case 'auth/network-request-failed':
    case 'unavailable':
      return '인터넷 연결을 확인한 후 다시 시도해 주세요.';

    case 'auth/too-many-requests':
      return '요청이 많아요. 잠시 후 다시 시도해 주세요.';

    case 'auth/user-disabled':
      return '사용이 중지된 계정입니다.';

    case 'permission-denied':
      return '가입 정보를 처리할 권한이 없어요. 관리자에게 문의해 주세요.';

    default:
      return '가입 처리를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}

export default function SignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState(
    typeof params.email === 'string' ? params.email : ''
  );
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [checkedNickname, setCheckedNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [incomplete, setIncomplete] = useState(false);

  const busy = useRef(false);

  const nicknameChecked =
    !!checkedNickname && checkedNickname === nickname.trim();

  const checkNickname = async () => {
    if (busy.current) return;

    const value = nickname.trim();

    if (value.length < 2) {
      return Alert.alert('알림', '닉네임은 2글자 이상 입력해 주세요.');
    }

    busy.current = true;
    setLoading(true);
    setCheckedNickname('');

    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('nickname', '==', value))
      );

      if (!snap.empty) {
        Alert.alert('중복', '이미 사용 중인 닉네임입니다.');
      } else {
        setNickname(value);
        setCheckedNickname(value);
        Alert.alert('확인', '사용 가능한 닉네임입니다.');
      }
    } catch (error) {
      Alert.alert('확인 실패', errorMessage(error));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (busy.current) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedNickname = nickname.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Alert.alert('형식 오류', '올바른 이메일을 입력해 주세요.');
    }

    if (!nicknameChecked) {
      return Alert.alert('알림', '닉네임 중복 확인을 해주세요.');
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{6,}$/.test(password)) {
      return Alert.alert(
        '비밀번호 확인',
        '영문과 숫자를 포함해 6자 이상 입력해 주세요. 공백은 사용할 수 없습니다.'
      );
    }

    busy.current = true;
    setLoading(true);
    setEmail(normalizedEmail);

    let authenticated = false;

    try {
      let user;

      try {
        const result = await createUserWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );
        user = result.user;
      } catch (error) {
        if (error.code !== 'auth/email-already-in-use') {
          throw error;
        }

        // 기존 비밀번호 인증에 성공한 경우에만 미완료 가입을 이어갑니다.
        try {
          const result = await signInWithEmailAndPassword(
            auth,
            normalizedEmail,
            password
          );
          user = result.user;
        } catch (loginError) {
          if (
            [
              'auth/invalid-credential',
              'auth/wrong-password',
              'auth/user-not-found',
            ].includes(loginError.code)
          ) {
            Alert.alert(
              '이미 등록된 이메일',
              '기존 비밀번호로 로그인해 주세요. 비밀번호를 잊었다면 재설정할 수 있어요.',
              [
                { text: '닫기', style: 'cancel' },
                {
                  text: '비밀번호 찾기',
                  onPress: () =>
                    router.push({
                      pathname: '/forgotpassword',
                      params: { email: normalizedEmail },
                    }),
                },
              ]
            );
            return;
          }

          throw loginError;
        }
      }

      authenticated = true;

      const userRef = doc(db, 'users', user.uid);
      const existing = await getDocFromServer(userRef);

      // 완료된 계정의 닉네임, 친구, 레벨 등을 덮어쓰지 않습니다.
      if (existing.exists()) {
        Alert.alert('로그인 완료', '이미 가입된 계정으로 로그인했어요.');
        router.replace('/home');
        return;
      }

      // 중복 확인 이후 다른 사용자가 같은 닉네임을 썼는지 재확인합니다.
      const nicknameSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('nickname', '==', normalizedNickname)
        )
      );

      if (!nicknameSnap.empty) {
        setCheckedNickname('');
        setIncomplete(true);

        Alert.alert(
          '닉네임 중복',
          '다른 닉네임을 선택한 뒤 가입을 이어서 완료해 주세요.'
        );
        return;
      }

      const inviteCode = await generateUniqueInviteCode();

      await updateProfile(user, {
        displayName: normalizedNickname,
      });

      await runTransaction(db, async (transaction) => {
        const latest = await transaction.get(userRef);

        if (latest.exists()) return;

        transaction.set(userRef, {
          email: normalizedEmail,
          nickname: normalizedNickname,
          createdAt: serverTimestamp(),
          level: '새싹 탐험가 🌱',
          inviteCode,
          friends: [],
        });
      });

      setIncomplete(false);

      Alert.alert(
        '환영합니다!',
        normalizedNickname + '님, 탐험을 시작해보세요!'
      );

      router.replace('/home');
    } catch (error) {
      setIncomplete(authenticated);

      Alert.alert(
        authenticated ? '가입 정보 저장 미완료' : '가입 실패',
        errorMessage(error) +
          (authenticated
            ? '\n\n같은 이메일과 비밀번호로 다시 눌러 가입을 이어서 완료해 주세요.'
            : '')
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerArea}>
          <Text style={styles.logo}>📍 Mappy</Text>
          <Text style={styles.subLogo}>새로운 탐험의 시작</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={styles.hint}>
          이메일 중복 여부는 가입할 때 확인해요.
        </Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            placeholder="닉네임"
            value={nickname}
            editable={!loading}
            onChangeText={(value) => {
              setNickname(value);
              setCheckedNickname('');
            }}
          />

          <TouchableOpacity
            style={[
              styles.checkBtn,
              nicknameChecked && styles.checkDone,
            ]}
            onPress={checkNickname}
            disabled={loading}
          >
            <Text style={styles.checkText}>
              {nicknameChecked ? '확인됨 ✓' : '중복 확인'}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="비밀번호 (영문+숫자 6자 이상)"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSignUp}
        />

        <Text style={styles.hint}>
          특수문자 사용 가능 · 공백 사용 불가
        </Text>

        {incomplete && (
          <Text style={styles.notice}>
            가입이 아직 완료되지 않았어요. 같은 이메일과 비밀번호로 이어서
            완료해 주세요.
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            (loading || !nicknameChecked) && styles.disabled,
          ]}
          onPress={handleSignUp}
          disabled={loading || !nicknameChecked}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>
              {incomplete ? '가입 이어서 완료하기' : '탐험 시작하기'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          disabled={loading}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.linkText}>
            이미 계정이 있으신가요? 로그인
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'white' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 30 },
  headerArea: { marginBottom: 40 },
  logo: {
    fontSize: 42, fontWeight: '900', textAlign: 'center',
    color: '#007AFF', letterSpacing: -1,
  },
  subLogo: {
    textAlign: 'center', color: '#8E8E93', marginTop: 10, fontSize: 16,
  },
  input: {
    backgroundColor: '#F2F2F7', padding: 18, borderRadius: 15,
    marginBottom: 12, fontSize: 15, color: '#1C1C1E',
  },
  inputFlex: { flex: 1, marginBottom: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  hint: {
    color: '#666', fontSize: 12, marginTop: -4,
    marginBottom: 14, marginLeft: 4,
  },
  checkBtn: {
    backgroundColor: '#007AFF', paddingHorizontal: 14,
    paddingVertical: 18, borderRadius: 15,
  },
  checkDone: { backgroundColor: '#34C759' },
  checkText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  notice: {
    backgroundColor: '#EEF6FF', color: '#005BBB', padding: 14,
    borderRadius: 12, lineHeight: 21, marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF', padding: 18, borderRadius: 15,
    alignItems: 'center', marginTop: 10,
  },
  disabled: { backgroundColor: '#C7C7CC' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 17 },
  link: { marginTop: 25, padding: 10 },
  linkText: { textAlign: 'center', color: '#8E8E93', fontSize: 14 },
});