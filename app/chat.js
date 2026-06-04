import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth } from '../firebaseConfig';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const timeAgo = (ts) => {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export default function ChatScreen() {
  const router = useRouter();
  const { roomId, roomName, district, createdBy } = useLocalSearchParams();
  const flatListRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState(roomName ?? '');
  const [editLoading, setEditLoading] = useState(false);

  const myEmail = auth.currentUser?.email;
  const isOwner = myEmail === createdBy;
  const myNickname = auth.currentUser?.displayName ?? '익명';

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [roomId]);

  const handleEditRoom = async () => {
    if (!editName.trim()) return;
    setEditLoading(true);
    try {
      await updateDoc(doc(db, 'chatRooms', roomId), { name: editName.trim() });
      setEditModal(false);
    } catch (e) { Alert.alert('오류', '수정에 실패했어요.'); }
    finally { setEditLoading(false); }
  };

  const handleDeleteRoom = () => {
    Alert.alert('방 삭제', '이 채팅방을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'chatRooms', roomId));
            router.back();
          } catch (e) { Alert.alert('오류', '삭제에 실패했어요.'); }
        }
      }
    ]);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        text,
        userEmail: myEmail,
        userNickname: myNickname,
        createdAt: serverTimestamp(),
      });
      // 마지막 메시지 업데이트
      await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMsg: text,
        lastMsgAt: serverTimestamp(),
      });
    } catch (e) { Alert.alert('오류', '메시지 전송에 실패했어요.'); }
    finally { setSending(false); }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.userEmail === myEmail;
    const prevMsg = messages[index - 1];
    const showNickname = !isMe && prevMsg?.userEmail !== item.userEmail;

    return (
      <View style={[styles.msgWrap, isMe ? styles.msgWrapMe : styles.msgWrapOther]}>
        {!isMe && (
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{(item.userNickname ?? '?')[0].toUpperCase()}</Text>
            </View>
            {item.userEmail === createdBy && (
              <View style={styles.crownBadge}>
                <Text style={styles.crownTxt}>👑</Text>
              </View>
            )}
          </View>
        )}
        <View style={[styles.msgCol, isMe && { alignItems: 'flex-end' }]}>
          {showNickname && <Text style={styles.nickname}>{item.userNickname}</Text>}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.msgTxt, isMe && { color: 'white' }]}>{item.text}</Text>
          </View>
          <Text style={styles.msgTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {isMe && <View style={styles.avatarPlaceholder} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{roomName}</Text>
          <Text style={styles.headerSub}>📍 {district}</Text>
        </View>
        {isOwner ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setEditModal(true)}>
            <Ionicons name="settings-outline" size={20} color="#1C1C1E" />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {/* 메시지 목록 */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubble-outline" size={40} color="#C7C7CC" />
              <Text style={styles.emptyTxt}>첫 번째 메시지를 남겨보세요!</Text>
            </View>
          }
        />
      )}

      {/* 입력창 */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor="#C7C7CC"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.4 }]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="white" />
              : <Ionicons name="send" size={18} color="white" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* 방장 관리 모달 */}
      <Modal visible={editModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setEditModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>채팅방 관리</Text>
            <Text style={styles.modalLabel}>방 이름 수정</Text>
            <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} maxLength={30} />
            <TouchableOpacity style={styles.editBtn} onPress={handleEditRoom} disabled={editLoading}>
              {editLoading ? <ActivityIndicator color="white" /> : <Text style={styles.editBtnTxt}>수정 완료</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.editBtn, { backgroundColor: '#FF3B30', marginTop: 10 }]} onPress={() => { setEditModal(false); handleDeleteRoom(); }}>
              <Text style={styles.editBtnTxt}>방 삭제</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  headerSub: { fontSize: 11, color: '#8E8E93', marginTop: 1 },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgList: { paddingHorizontal: 16, paddingVertical: 16, gap: 4 },

  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgWrapMe: { justifyContent: 'flex-end' },
  msgWrapOther: { justifyContent: 'flex-start' },

  avatarWrap: { position: 'relative', marginBottom: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center' },
  crownBadge: { position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  crownTxt: { fontSize: 9 },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#185FA5' },
  avatarPlaceholder: { width: 32 },

  msgCol: { maxWidth: '72%', gap: 3 },
  nickname: { fontSize: 11, color: '#8E8E93', marginLeft: 4, fontWeight: '600' },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: 'white', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  msgTxt: { fontSize: 15, color: '#1C1C1E', lineHeight: 21 },
  msgTime: { fontSize: 10, color: '#AEAEB2', marginHorizontal: 4 },

  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTxt: { fontSize: 14, color: '#C7C7CC' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F2F2F7',
  },
  input: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#1C1C1E', maxHeight: 100,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  modalSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  modalInput: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 20 },
  editBtn: { backgroundColor: '#1C1C1E', padding: 16, borderRadius: 14, alignItems: 'center' },
  editBtnTxt: { color: 'white', fontWeight: '800', fontSize: 16 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center',
  },
});