import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Image,
  Modal,
  Pressable,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { db, auth, storage } from '../../firebaseConfig';

import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from 'firebase/firestore';

import { ref, getDownloadURL } from 'firebase/storage';
import { useRouter, useFocusEffect } from 'expo-router';


// =========================
// 시간 표시
// =========================
const timeAgo = (createdAt) => {
  if (!createdAt) return '';

  const date = createdAt?.toDate
    ? createdAt.toDate()
    : new Date(createdAt);

  const diff = Math.floor(
    (Date.now() - date.getTime()) / 1000
  );

  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;

  return `${Math.floor(diff / 86400)}일 전`;
};


// =========================
// 필터 옵션
// =========================
const FILTER_OPTIONS = [
  '전체',
  '추천',
  '주의',
];

const CATEGORY_OPTIONS = [
  { id: '전체', label: '전체' },
  { id: 'food', label: '🍽️ 음식점' },
  { id: 'cafe', label: '☕ 카페' },
  { id: 'nature', label: '🌿 자연·공원' },
  { id: 'culture', label: '🎨 문화·전시' },
  { id: 'popup', label: '🎪 팝업' },
  { id: 'shop', label: '🛍️ 쇼핑' },
  { id: 'hospital', label: '🏥 병원·약국' },
  { id: 'beauty', label: '💇 미용' },
  { id: 'parking', label: '🚗 주차장' },
  { id: 'stay', label: '🏨 숙소' },
  { id: 'fitness', label: '🏋️ 운동' },
  { id: 'study', label: '📚 카공' },
  { id: 'play', label: '🎮 오락' },
  { id: 'etc', label: '📍 기타' },
];


export default function FeedTab() {
  const router = useRouter();

  const [feedData, setFeedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeFilter, setActiveFilter] = useState('전체');
  const [activeCategory, setActiveCategory] = useState('전체');

  

  // 친구별 피드 필터
const [friends, setFriends] = useState([]);
const [selectedFriendUids, setSelectedFriendUids] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [thumbnails, setThumbnails] = useState({});

  // 정렬
  const [sortType, setSortType] = useState('latest');

  // 필터 모달
  const [showFilter, setShowFilter] = useState(false);

  // 정렬 드롭다운
  const [showSort, setShowSort] = useState(false);


  // =========================
  // 피드 불러오기
  // =========================
  const fetchFeed = async () => {
    try {
      const myUid = auth.currentUser?.uid;
      const myEmail = auth.currentUser?.email;

      if (!myUid) return;

      // 내 친구 목록
      const myDoc = await getDoc(
        doc(db, 'users', myUid)
      );

      const friendUids = myDoc.exists()
        ? myDoc.data().friends ?? []
        : [];
        // 친구 UID → 친구 정보(닉네임) 불러오기
const friendList = await Promise.all(
  friendUids.map(async (uid) => {
    try {
      const friendSnap = await getDoc(
        doc(db, 'users', uid)
      );

      if (!friendSnap.exists()) return null;

      const data = friendSnap.data();

      return {
        uid,
        nickname: data.nickname || '친구',
      };
    } catch (e) {
      return null;
    }
  })
);

setFriends(friendList.filter(Boolean));

      const allowedUids = [
        myUid,
        ...friendUids,
      ];

      const q = query(
        collection(db, 'places'),
        orderBy('createdAt', 'desc')
      );

      const snap = await getDocs(q);

      const items = snap.docs
        .map((d) => {
          const data = d.data();

          const likes = data.likes ?? [];
          const bookmarks = data.bookmarks ?? [];

          return {
            id: d.id,
            ...data,

            likeCount: likes.length,

            liked: myEmail
              ? likes.includes(myEmail)
              : false,

            bookmarks,
          };
        })
        .filter((item) =>
          allowedUids.includes(item.userUid)
        );

      setFeedData(items);

      loadThumbnails(items);
    } catch (e) {
      console.log(
        '피드 불러오기 오류:',
        e
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  // =========================
  // 썸네일 불러오기
  // =========================
  const loadThumbnails = async (data) => {
    const newThumbs = {};

    await Promise.all(
      data.map(async (item) => {
        const path =
          item.imagePaths?.[0];

        if (path) {
          try {
            const url =
              await getDownloadURL(
                ref(storage, path)
              );

            newThumbs[item.id] =
              url;
          } catch (e) {
            // 이미지 오류는 무시
          }
        }
      })
    );

    setThumbnails((prev) => ({
      ...prev,
      ...newThumbs,
    }));
  };


  // 화면 들어올 때마다 갱신
  useFocusEffect(
    useCallback(() => {
      fetchFeed();
    }, [])
  );


  // =========================
  // 새로고침
  // =========================
  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };


  // =========================
  // 좋아요
  // =========================
  const toggleLike = async (itemId) => {
    const myEmail =
      auth.currentUser?.email;

    if (!myEmail) return;

    const item =
      feedData.find(
        (d) => d.id === itemId
      );

    if (!item) return;

    const placeRef =
      doc(db, 'places', itemId);

    if (item.liked) {
      await updateDoc(placeRef, {
        likes: arrayRemove(myEmail),
      });

      setFeedData((prev) =>
        prev.map((d) =>
          d.id === itemId
            ? {
                ...d,
                liked: false,
                likeCount:
                  Math.max(
                    0,
                    d.likeCount - 1
                  ),
              }
            : d
        )
      );
    } else {
      await updateDoc(placeRef, {
        likes: arrayUnion(myEmail),
      });

      setFeedData((prev) =>
        prev.map((d) =>
          d.id === itemId
            ? {
                ...d,
                liked: true,
                likeCount:
                  d.likeCount + 1,
              }
            : d
        )
      );
    }
  };


  // =========================
  // 북마크
  // =========================
  const toggleBookmark =
    async (itemId) => {
      const myEmail =
        auth.currentUser?.email;

      if (!myEmail) return;

      const item =
        feedData.find(
          (d) => d.id === itemId
        );

      if (!item) return;

      const placeRef =
        doc(db, 'places', itemId);

      const isBookmarked =
        (
          item.bookmarks ?? []
        ).includes(myEmail);

      if (isBookmarked) {
        await updateDoc(placeRef, {
          bookmarks:
            arrayRemove(myEmail),
        });

        setFeedData((prev) =>
          prev.map((d) =>
            d.id === itemId
              ? {
                  ...d,
                  bookmarks:
                    (
                      d.bookmarks ??
                      []
                    ).filter(
                      (email) =>
                        email !==
                        myEmail
                    ),
                }
              : d
          )
        );
      } else {
        await updateDoc(placeRef, {
          bookmarks:
            arrayUnion(myEmail),
        });

        setFeedData((prev) =>
          prev.map((d) =>
            d.id === itemId
              ? {
                  ...d,
                  bookmarks: [
                    ...(
                      d.bookmarks ??
                      []
                    ),
                    myEmail,
                  ],
                }
              : d
          )
        );
      }
    };


  // =========================
  // 필터
  // =========================
  const filteredData =
    feedData
      .filter((item) => {
        if (
          activeFilter ===
          '전체'
        ) {
          return true;
        }

        if (
          activeFilter ===
          '추천'
        ) {
          return (
            item.type === 'blue'
          );
        }

        return (
          item.type === 'red'
        );
      })
      .filter((item) => {
        if (
          activeCategory ===
          '전체'
        ) {
          return true;
        }

        return (
          item.category ===
          activeCategory
        );
      })

      .filter((item) => {
  // 선택한 친구가 없으면 전체 보기
  if (selectedFriendUids.length === 0) {
    return true;
  }

  // 선택한 친구가 작성한 글만 보기
  return selectedFriendUids.includes(item.userUid);
})
      .filter((item) => {
        if (
          !searchText.trim()
        ) {
          return true;
        }

        const q =
          searchText
            .toLowerCase();

        return (
          (
            item.title ?? ''
          )
            .toLowerCase()
            .includes(q) ||

          (
            item.description ??
            ''
          )
            .toLowerCase()
            .includes(q) ||

          (
            item.address ?? ''
          )
            .toLowerCase()
            .includes(q) ||

          (
            item.tags ?? []
          ).some((tag) =>
            tag
              .toLowerCase()
              .includes(q)
          )
        );
      });


  // =========================
  // 정렬
  // =========================
  const sortedData = [
    ...filteredData,
  ].sort((a, b) => {
    // 인기순
    if (
      sortType === 'popular'
    ) {
      const likeDiff =
        (b.likeCount ?? 0) -
        (a.likeCount ?? 0);

      // 좋아요 수가 다르면
      // 좋아요 많은 글 우선
      if (likeDiff !== 0) {
        return likeDiff;
      }
    }

    // 최신순
    // 인기순에서도 좋아요가 같으면
    // 최신 글 우선
    const aTime =
      a.createdAt?.toDate
        ? a.createdAt
            .toDate()
            .getTime()
        : new Date(
            a.createdAt ?? 0
          ).getTime();

    const bTime =
      b.createdAt?.toDate
        ? b.createdAt
            .toDate()
            .getTime()
        : new Date(
            b.createdAt ?? 0
          ).getTime();

    return bTime - aTime;
  });


  // 적용된 필터 개수
 const activeFilterCount =
  (activeFilter !== '전체' ? 1 : 0) +
  (activeCategory !== '전체' ? 1 : 0) +
  (selectedFriendUids.length > 0 ? 1 : 0);


  // =========================
  // 상세 페이지 이동
  // =========================
  const goToDetail = (item) => {
    router.push({
      pathname: '/detail',

      params: {
        id: item.id,
        title: item.title,
        description:
          item.description,
        type: item.type,

        user:
          item.userNickname,

        userEmail:
          item.userEmail ?? '',

        address:
          item.address ?? '',

        detailAddress:
          item.detailAddress ??
          '',

        imagePaths:
          encodeURIComponent(
            JSON.stringify(
              item.imagePaths ??
                []
            )
          ),

        tags:
          JSON.stringify(
            item.tags ?? []
          ),

        category:
          item.category ?? '',

        verified:
          item.verified
            ? 'true'
            : 'false',
      },
    });
  };


  // =========================
  // 추천 / 주의 필터 버튼
  // =========================
  const renderFilterPill =
    (label) => {
      const isActive =
        activeFilter === label;

      const activeBg =
        label === '주의'
          ? '#FF3B30'
          : '#007AFF';

      return (
        <TouchableOpacity
          key={label}
          onPress={() =>
            setActiveFilter(
              label
            )
          }
          style={[
            styles.filterPill,

            isActive && {
              backgroundColor:
                activeBg,

              borderColor:
                activeBg,
            },
          ]}
          activeOpacity={0.75}
        >
          {label ===
            '추천' && (
            <Ionicons
              name="thumbs-up"
              size={12}
              color={
                isActive
                  ? '#fff'
                  : '#8E8E93'
              }
              style={{
                marginRight: 4,
              }}
            />
          )}

          {label ===
            '주의' && (
            <Ionicons
              name="alert-circle"
              size={12}
              color={
                isActive
                  ? '#fff'
                  : '#8E8E93'
              }
              style={{
                marginRight: 4,
              }}
            />
          )}

          <Text
            style={[
              styles.filterPillText,

              isActive && {
                color: '#fff',
              },
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    };


  // =========================
  // 카드
  // =========================
  const renderCard = ({
    item,
  }) => {
    const isRecommend =
      item.type === 'blue';

    const accentColor =
      isRecommend
        ? '#007AFF'
        : '#FF3B30';

    const tagBg =
      isRecommend
        ? '#EAF3FF'
        : '#FFF0EF';

    const nickname =
      item.userNickname ??
      '익명';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() =>
          goToDetail(item)
        }
      >
        <View
          style={[
            styles.cardAccentBar,
            {
              backgroundColor:
                accentColor,
            },
          ]}
        />

        <View
          style={styles.cardInner}
        >
          {/* 이미지 */}
          {thumbnails[
            item.id
          ] && (
            <Image
              source={{
                uri: thumbnails[
                  item.id
                ],
              }}
              style={
                styles.thumbnail
              }
            />
          )}

          {/* 작성자 */}
          <View
            style={
              styles.cardHeader
            }
          >
            <TouchableOpacity
              style={
                styles.userRow
              }
              activeOpacity={0.7}
              onPress={async () => {
                if (
                  !item.userEmail
                ) {
                  return;
                }

                try {
                  const {
                    getDocs,
                    collection,
                    query,
                    where,
                  } =
                    await import(
                      'firebase/firestore'
                    );

                  const snap =
                    await getDocs(
                      query(
                        collection(
                          db,
                          'users'
                        ),

                        where(
                          'email',
                          '==',
                          item.userEmail
                        )
                      )
                    );

                  if (
                    !snap.empty
                  ) {
                    router.push({
                      pathname:
                        '/userprofile',

                      params: {
                        uid:
                          snap
                            .docs[0]
                            .id,

                        nickname:
                          item.userNickname,
                      },
                    });
                  }
                } catch (e) {}
              }}
            >
              <View
                style={[
                  styles.avatar,

                  {
                    backgroundColor:
                      accentColor +
                      '22',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,

                    {
                      color:
                        accentColor,
                    },
                  ]}
                >
                  {nickname ===
                  '익명'
                    ? '?'
                    : nickname[0].toUpperCase()}
                </Text>
              </View>

              <View>
                <Text
                  style={
                    styles.userName
                  }
                >
                  {nickname}
                </Text>

                <Text
                  style={
                    styles.timeText
                  }
                >
                  {timeAgo(
                    item.createdAt
                  )}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 추천 / 주의 */}
            <View
              style={[
                styles.tag,

                {
                  backgroundColor:
                    tagBg,
                },
              ]}
            >
              <Ionicons
                name={
                  isRecommend
                    ? 'thumbs-up'
                    : 'alert-circle'
                }
                size={12}
                color={
                  accentColor
                }
              />

              <Text
                style={[
                  styles.tagText,

                  {
                    color:
                      accentColor,
                  },
                ]}
              >
                {isRecommend
                  ? '추천'
                  : '주의'}
              </Text>
            </View>
          </View>

          {/* 제목 */}
          <View
            style={{
              flexDirection:
                'row',

              alignItems:
                'center',

              gap: 6,

              marginBottom: 5,
            }}
          >
            <Text
              style={
                styles.cardTitle
              }
            >
              {item.title}
            </Text>

            {item.verified && (
              <View
                style={
                  styles.verifiedBadge
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={13}
                  color="#34C759"
                />

                <Text
                  style={
                    styles.verifiedTxt
                  }
                >
                  인증
                </Text>
              </View>
            )}
          </View>

          {/* 설명 */}
          {item.description ? (
            <Text
              style={
                styles.cardDesc
              }
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}

          {/* 주소 */}
          {item.address ? (
            <View
              style={
                styles.addressRow
              }
            >
              <Ionicons
                name="location-outline"
                size={12}
                color="#8E8E93"
              />

              <Text
                style={
                  styles.addressText
                }
                numberOfLines={1}
              >
                {item.address}
              </Text>
            </View>
          ) : null}

          {/* 태그 */}
          {item.tags?.length >
            0 && (
            <View
              style={
                styles.tagRow
              }
            >
              {item.tags
                .slice(0, 3)
                .map(
                  (
                    tag,
                    i
                  ) => (
                    <View
                      key={i}
                      style={
                        styles.tagChip
                      }
                    >
                      <Text
                        style={
                          styles.tagChipTxt
                        }
                      >
                        {tag}
                      </Text>
                    </View>
                  )
                )}
            </View>
          )}

          {/* 액션 */}
          <View
            style={
              styles.actionRow
            }
          >
            {/* 좋아요 */}
            <TouchableOpacity
              style={
                styles.actionBtn
              }
              activeOpacity={0.7}
              onPress={() =>
                toggleLike(
                  item.id
                )
              }
            >
              <Ionicons
                name={
                  item.liked
                    ? 'heart'
                    : 'heart-outline'
                }
                size={18}
                color={
                  item.liked
                    ? '#FF2D55'
                    : '#8E8E93'
                }
              />

              {item.likeCount >
                0 && (
                <Text
                  style={[
                    styles.actionCount,

                    item.liked && {
                      color:
                        '#FF2D55',
                    },
                  ]}
                >
                  {
                    item.likeCount
                  }
                </Text>
              )}
            </TouchableOpacity>

            {/* 댓글 */}
            <TouchableOpacity
              style={
                styles.actionBtn
              }
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname:
                    '/detail',

                  params: {
                    id: item.id,

                    title:
                      item.title,

                    description:
                      item.description,

                    type:
                      item.type,

                    user:
                      item.userNickname,

                    userEmail:
                      item.userEmail ??
                      '',

                    address:
                      item.address ??
                      '',

                    detailAddress:
                      item.detailAddress ??
                      '',

                    imagePaths:
                      encodeURIComponent(
                        JSON.stringify(
                          item.imagePaths ??
                            []
                        )
                      ),

                    tags:
                      JSON.stringify(
                        item.tags ??
                          []
                      ),

                    category:
                      item.category ??
                      '',

                    verified:
                      item.verified
                        ? 'true'
                        : 'false',

                    scrollToComment:
                      'true',
                  },
                })
              }
            >
              <Ionicons
                name="chatbubble-outline"
                size={17}
                color="#8E8E93"
              />
            </TouchableOpacity>

            {/* 북마크 */}
            <TouchableOpacity
              style={
                styles.actionBtn
              }
              activeOpacity={0.7}
              onPress={() =>
                toggleBookmark(
                  item.id
                )
              }
            >
              <Ionicons
                name={
                  (
                    item.bookmarks ??
                    []
                  ).includes(
                    auth.currentUser
                      ?.email
                  )
                    ? 'bookmark'
                    : 'bookmark-outline'
                }
                size={17}
                color={
                  (
                    item.bookmarks ??
                    []
                  ).includes(
                    auth.currentUser
                      ?.email
                  )
                    ? '#007AFF'
                    : '#8E8E93'
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  // =========================
  // 화면
  // =========================
  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >
        {/* 헤더 */}
        <View
          style={styles.header}
        >
          <View>
            <Text
              style={
                styles.headerLabel
              }
            >
              FEED
            </Text>

            <Text
              style={
                styles.headerTitle
              }
            >
              피드
            </Text>
          </View>

          {/* 검색 */}
          <TouchableOpacity
            style={[
              styles.iconBtn,

              isSearching && {
                backgroundColor:
                  '#EAF3FF',
              },
            ]}
            onPress={() => {
              setIsSearching(
                (prev) => !prev
              );

              setSearchText('');
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={
                isSearching
                  ? 'close'
                  : 'search-outline'
              }
              size={22}
              color={
                isSearching
                  ? '#007AFF'
                  : '#1C1C1E'
              }
            />
          </TouchableOpacity>
        </View>


        {/* 검색창 */}
        {isSearching && (
          <View
            style={styles.searchBar}
          >
            <Ionicons
              name="search-outline"
              size={16}
              color="#8E8E93"
            />

            <TextInput
              style={
                styles.searchInput
              }
              placeholder="장소 이름, 태그, 주소 검색..."
              placeholderTextColor="#C7C7CC"
              value={searchText}
              onChangeText={
                setSearchText
              }
              autoFocus
              returnKeyType="search"
            />

            {searchText.length >
              0 && (
              <TouchableOpacity
                onPress={() =>
                  setSearchText('')
                }
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color="#C7C7CC"
                />
              </TouchableOpacity>
            )}
          </View>
        )}


        {/* =========================
            필터 / 정렬
        ========================= */}
        <View
          style={
            styles.controlRow
          }
        >
          <View
            style={
              styles.controlLeft
            }
          >
            {/* 필터 버튼 */}
            <TouchableOpacity
              style={[
                styles.controlBtn,

                activeFilterCount >
                  0 &&
                  styles.controlBtnActive,
              ]}
              onPress={() => {
                setShowSort(false);
                setShowFilter(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={
                  activeFilterCount >
                  0
                    ? '#007AFF'
                    : '#3A3A3C'
                }
              />

              <Text
                style={[
                  styles.controlBtnText,

                  activeFilterCount >
                    0 &&
                    styles.controlBtnTextActive,
                ]}
              >
                필터
                {activeFilterCount >
                  0
                  ? ` ${activeFilterCount}`
                  : ''}
              </Text>
            </TouchableOpacity>

           
          </View>

          {/* 정렬 */}
          <TouchableOpacity
            style={
              styles.sortDropdownBtn
            }
            onPress={() =>
              setShowSort(true)
            }
            activeOpacity={0.7}
          >
            <Text
              style={
                styles.sortDropdownText
              }
            >
              {sortType ===
              'latest'
                ? '최신순'
                : '인기순'}
            </Text>

            <Ionicons
              name="chevron-down"
              size={15}
              color="#8E8E93"
            />
          </TouchableOpacity>
        </View>


        {/* =========================
            필터 모달
        ========================= */}
        <Modal
          visible={showFilter}
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowFilter(false)
          }
        >
          <View
            style={
              styles.modalRoot
            }
          >
            {/* 배경 */}
            <Pressable
              style={
                styles.modalBackdrop
              }
              onPress={() =>
                setShowFilter(false)
              }
            />

            {/* 필터 시트 */}
            <View
              style={
                styles.filterSheet
              }
            >
              {/* 손잡이 */}
              <View
                style={
                  styles.sheetHandle
                }
              />

              {/* 제목 */}
              <View
                style={
                  styles.sheetHeader
                }
              >
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  필터
                </Text>

                <TouchableOpacity
                  style={
                    styles.sheetCloseBtn
                  }
                  onPress={() =>
                    setShowFilter(
                      false
                    )
                  }
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color="#3A3A3C"
                  />
                </TouchableOpacity>
              </View>


              {/* 유형 */}
              <Text
                style={
                  styles.sheetSectionTitle
                }
              >
                유형
              </Text>

              <View
                style={
                  styles.sheetOptionWrap
                }
              >
                {FILTER_OPTIONS.map(
                  renderFilterPill
                )}
              </View>


              {/* 카테고리 */}
              <Text
                style={[
                  styles.sheetSectionTitle,
                  {
                    marginTop: 24,
                  },
                ]}
              >
                카테고리
              </Text>

              <ScrollView
                style={
                  styles.categoryScroll
                }
                showsVerticalScrollIndicator={
                  false
                }
              >
                <View
                  style={
                    styles.sheetOptionWrap
                  }
                >
                  {CATEGORY_OPTIONS.map(
                    (cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() =>
                          setActiveCategory(
                            cat.id
                          )
                        }
                        style={[
                          styles.categoryPill,

                          activeCategory ===
                            cat.id &&
                            styles.categoryPillActive,
                        ]}
                        activeOpacity={
                          0.75
                        }
                      >
                        <Text
                          style={[
                            styles.categoryPillTxt,

                            activeCategory ===
                              cat.id &&
                              styles.categoryPillTxtActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </ScrollView>

              {/* 친구 */}
<Text
  style={[
    styles.sheetSectionTitle,
    { marginTop: 24 },
  ]}
>
  친구
</Text>

<View style={styles.sheetOptionWrap}>
  <TouchableOpacity
    onPress={() => setSelectedFriendUids([])}
    style={[
      styles.categoryPill,
      selectedFriendUids.length === 0 &&
        styles.categoryPillActive,
    ]}
    activeOpacity={0.75}
  >
    <Text
      style={[
        styles.categoryPillTxt,
        selectedFriendUids.length === 0 &&
          styles.categoryPillTxtActive,
      ]}
    >
      👥 전체 친구
    </Text>
  </TouchableOpacity>

  {friends.map((friend) => {
    const isSelected =
      selectedFriendUids.includes(friend.uid);

    return (
      <TouchableOpacity
        key={friend.uid}
        onPress={() => {
          setSelectedFriendUids((prev) =>
            prev.includes(friend.uid)
              ? prev.filter(
                  (uid) => uid !== friend.uid
                )
              : [...prev, friend.uid]
          );
        }}
        style={[
          styles.categoryPill,
          isSelected && styles.categoryPillActive,
        ]}
        activeOpacity={0.75}
      >
        <Text
          style={[
            styles.categoryPillTxt,
            isSelected &&
              styles.categoryPillTxtActive,
          ]}
        >
          {friend.nickname}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>


              {/* 하단 버튼 */}
              <View
                style={
                  styles.sheetBottomRow
                }
              >
                {/* 초기화 */}
                <TouchableOpacity
                  style={
                    styles.resetBtn
                  }
                  onPress={() => {
                    setActiveFilter(
                      '전체'
                    );

                    setActiveCategory(
                      '전체'
                    );
                    setSelectedFriendUids([]);
                  }}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={17}
                    color="#3A3A3C"
                  />

                  <Text
                    style={
                      styles.resetBtnText
                    }
                  >
                    초기화
                  </Text>
                </TouchableOpacity>

                {/* 적용 */}
                <TouchableOpacity
                  style={
                    styles.applyBtn
                  }
                  onPress={() =>
                    setShowFilter(
                      false
                    )
                  }
                >
                  <Text
                    style={
                      styles.applyBtnText
                    }
                  >
                    {sortedData.length}개
                    결과 보기
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>


        {/* =========================
            정렬 메뉴
        ========================= */}
        <Modal
          visible={showSort}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setShowSort(false)
          }
        >
          <View
            style={
              styles.sortModalRoot
            }
          >
            <Pressable
              style={
                styles.modalBackdrop
              }
              onPress={() =>
                setShowSort(false)
              }
            />

            <View
              style={
                styles.sortMenu
              }
            >
              {/* 최신순 */}
              <TouchableOpacity
                style={
                  styles.sortMenuItem
                }
                onPress={() => {
                  setSortType(
                    'latest'
                  );

                  setShowSort(false);
                }}
              >
                <Text
                  style={[
                    styles.sortMenuText,

                    sortType ===
                      'latest' &&
                      styles.sortMenuTextActive,
                  ]}
                >
                  최신순
                </Text>

                {sortType ===
                  'latest' && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color="#007AFF"
                  />
                )}
              </TouchableOpacity>

              <View
                style={
                  styles.sortDivider
                }
              />

              {/* 인기순 */}
              <TouchableOpacity
                style={
                  styles.sortMenuItem
                }
                onPress={() => {
                  setSortType(
                    'popular'
                  );

                  setShowSort(false);
                }}
              >
                <Text
                  style={[
                    styles.sortMenuText,

                    sortType ===
                      'popular' &&
                      styles.sortMenuTextActive,
                  ]}
                >
                  인기순
                </Text>

                {sortType ===
                  'popular' && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color="#007AFF"
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>


        {/* =========================
            피드 목록
        ========================= */}
        {loading ? (
          <View
            style={
              styles.loadingBox
            }
          >
            <ActivityIndicator
              size="large"
              color="#007AFF"
            />
          </View>
        ) : (
          <FlatList
            data={sortedData}
            keyExtractor={(item) =>
              item.id
            }
            renderItem={renderCard}
            contentContainerStyle={
              styles.listContent
            }
            showsVerticalScrollIndicator={
              false
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  onRefresh
                }
                tintColor="#007AFF"
              />
            }
            ListEmptyComponent={
              <View
                style={
                  styles.emptyState
                }
              >
                <Ionicons
                  name="file-tray-outline"
                  size={48}
                  color="#C7C7CC"
                />

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  아직 피드가 없어요
                </Text>

                <Text
                  style={
                    styles.emptySubText
                  }
                >
                  첫 번째 장소를
                  등록해보세요!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}


// =========================
// 스타일
// =========================
const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#F2F2F7',
    },

    container: {
      flex: 1,
      backgroundColor:
        '#F2F2F7',
    },

    loadingBox: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
    },


    // =====================
    // 헤더
    // =====================
    header: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',

      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,

      backgroundColor:
        '#F2F2F7',
    },

    headerLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: '#007AFF',
      letterSpacing: 1.5,
      marginBottom: 2,
    },

    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#1C1C1E',
      letterSpacing: -0.5,
    },


    // =====================
    // 검색
    // =====================
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,

      backgroundColor:
        '#fff',

      borderRadius: 12,

      paddingHorizontal: 14,
      paddingVertical: 10,

      marginHorizontal: 20,
      marginBottom: 8,

      borderWidth: 1.5,
      borderColor: '#E5E5EA',
    },

    searchInput: {
      flex: 1,
      fontSize: 15,
      color: '#1C1C1E',
    },

    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,

      backgroundColor:
        '#fff',

      alignItems: 'center',
      justifyContent:
        'center',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 1,
      },

      shadowOpacity: 0.06,
      shadowRadius: 4,

      elevation: 2,
    },


    // =====================
    // 필터 / 정렬 상단
    // =====================
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',

      paddingHorizontal: 20,
      paddingBottom: 12,
    },

    controlLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    controlBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,

      backgroundColor:
        '#fff',

      borderWidth: 1.5,
      borderColor: '#E5E5EA',

      paddingHorizontal: 13,
      paddingVertical: 8,

      borderRadius: 18,
    },

    controlBtnActive: {
      backgroundColor:
        '#EAF3FF',

      borderColor:
        '#B8D8FF',
    },

    controlBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#3A3A3C',
    },

    controlBtnTextActive: {
      color: '#007AFF',
    },

    resultCount: {
      fontSize: 12,
      color: '#8E8E93',
      fontWeight: '500',
    },

    sortDropdownBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,

      paddingHorizontal: 8,
      paddingVertical: 7,
    },

    sortDropdownText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#3A3A3C',
    },


    // =====================
    // 모달 공통
    // =====================
    modalRoot: {
      flex: 1,
      justifyContent:
        'flex-end',
    },

    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(0,0,0,0.28)',
    },


    // =====================
    // 필터 모달
    // =====================
    filterSheet: {
      backgroundColor:
        '#F9F9FB',

      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,

      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 28,

      maxHeight: '78%',
    },

    sheetHandle: {
      width: 38,
      height: 5,

      borderRadius: 3,

      backgroundColor:
        '#D1D1D6',

      alignSelf: 'center',

      marginBottom: 14,
    },

    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',

      justifyContent:
        'space-between',

      marginBottom: 22,
    },

    sheetTitle: {
      fontSize: 21,
      fontWeight: '800',
      color: '#1C1C1E',
    },

    sheetCloseBtn: {
      width: 34,
      height: 34,

      borderRadius: 17,

      backgroundColor:
        '#EFEFF4',

      alignItems: 'center',
      justifyContent:
        'center',
    },

    sheetSectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#1C1C1E',

      marginBottom: 10,
    },

    sheetOptionWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    categoryScroll: {
      maxHeight: 260,
    },


    // =====================
    // 필터 선택 버튼
    // =====================
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',

      paddingHorizontal: 14,
      paddingVertical: 8,

      borderRadius: 20,

      backgroundColor:
        '#fff',

      borderWidth: 1.5,
      borderColor: '#E5E5EA',
    },

    filterPillText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#8E8E93',
    },

    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,

      borderRadius: 20,

      backgroundColor:
        '#fff',

      borderWidth: 1.5,
      borderColor: '#E5E5EA',
    },

    categoryPillActive: {
      backgroundColor:
        '#1C1C1E',

      borderColor:
        '#1C1C1E',
    },

    categoryPillTxt: {
      fontSize: 13,
      fontWeight: '600',
      color: '#8E8E93',
    },

    categoryPillTxtActive: {
      color: '#fff',
    },


    // =====================
    // 필터 하단 버튼
    // =====================
    sheetBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,

      marginTop: 24,
    },

    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',

      gap: 5,

      height: 48,

      paddingHorizontal: 17,

      borderRadius: 14,

      backgroundColor:
        '#EFEFF4',
    },

    resetBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#3A3A3C',
    },

    applyBtn: {
      flex: 1,
      height: 48,

      borderRadius: 14,

      backgroundColor:
        '#007AFF',

      alignItems: 'center',
      justifyContent:
        'center',
    },

    applyBtnText: {
      fontSize: 15,
      fontWeight: '800',
      color: '#fff',
    },


    // =====================
    // 정렬 메뉴
    // =====================
    sortModalRoot: {
      flex: 1,
      justifyContent:
        'flex-start',
      alignItems: 'flex-end',
    },

    sortMenu: {
      width: 150,

      marginTop: 155,
      marginRight: 20,

      backgroundColor:
        '#fff',

      borderRadius: 14,

      paddingVertical: 4,

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 5,
      },

      shadowOpacity: 0.14,
      shadowRadius: 14,

      elevation: 8,
    },

    sortMenuItem: {
      height: 46,

      paddingHorizontal: 15,

      flexDirection: 'row',
      alignItems: 'center',

      justifyContent:
        'space-between',
    },

    sortMenuText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#3A3A3C',
    },

    sortMenuTextActive: {
      color: '#007AFF',
      fontWeight: '700',
    },

    sortDivider: {
      height: 1,

      backgroundColor:
        '#F2F2F7',

      marginHorizontal: 12,
    },


    // =====================
    // 리스트
    // =====================
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 100,
    },


    // =====================
    // 카드
    // =====================
    card: {
      flexDirection: 'row',

      backgroundColor:
        '#fff',

      borderRadius: 18,

      marginBottom: 12,

      overflow: 'hidden',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity: 0.07,
      shadowRadius: 10,

      elevation: 3,
    },

    cardAccentBar: {
      width: 4,

      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
    },

    thumbnail: {
      width: '100%',
      height: 160,

      borderRadius: 12,

      marginBottom: 10,

      resizeMode: 'cover',
    },

    cardInner: {
      flex: 1,
      padding: 14,
    },

    cardHeader: {
      flexDirection: 'row',

      justifyContent:
        'space-between',

      alignItems: 'center',

      marginBottom: 10,
    },

    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    avatar: {
      width: 34,
      height: 34,

      borderRadius: 17,

      alignItems: 'center',
      justifyContent:
        'center',
    },

    avatarText: {
      fontSize: 14,
      fontWeight: '700',
    },

    userName: {
      fontSize: 13,
      fontWeight: '700',
      color: '#1C1C1E',
    },

    timeText: {
      fontSize: 11,
      color: '#AEAEB2',
      marginTop: 1,
    },

    tag: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 4,

      paddingHorizontal: 10,
      paddingVertical: 4,

      borderRadius: 20,
    },

    tagText: {
      fontSize: 12,
      fontWeight: '700',
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: '700',

      color: '#1C1C1E',

      letterSpacing: -0.2,
    },

    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 3,

      backgroundColor:
        '#EDFAF4',

      paddingHorizontal: 7,
      paddingVertical: 2,

      borderRadius: 8,
    },

    verifiedTxt: {
      fontSize: 11,
      fontWeight: '700',
      color: '#34C759',
    },

    cardDesc: {
      fontSize: 14,
      color: '#3A3A3C',

      lineHeight: 20,

      marginBottom: 8,
    },

    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 4,

      marginBottom: 8,
    },

    addressText: {
      fontSize: 12,
      color: '#8E8E93',
      flex: 1,
    },

    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',

      gap: 6,

      marginBottom: 10,
    },

    tagChip: {
      backgroundColor:
        '#F2F2F7',

      paddingHorizontal: 10,
      paddingVertical: 4,

      borderRadius: 12,
    },

    tagChipTxt: {
      fontSize: 11,
      color: '#3A3A3C',
      fontWeight: '500',
    },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',

      gap: 16,

      borderTopWidth: 1,
      borderTopColor:
        '#F2F2F7',

      paddingTop: 10,
    },

    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    actionCount: {
      fontSize: 13,
      color: '#8E8E93',
      fontWeight: '500',
    },


    // =====================
    // 빈 피드
    // =====================
    emptyState: {
      alignItems: 'center',
      paddingTop: 40,
      gap: 8,
    },

    emptyText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#8E8E93',
      marginTop: 8,
    },

    emptySubText: {
      fontSize: 13,
      color: '#AEAEB2',
    },
  });