import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { safeImpactAsync } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { supabase } from '@/services/supabase';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';
import { spacing, radius } from '@/constants/layout';
import { ChatMessageItem } from '@/types/app';

export default function ChatRoomScreen() {
  const { roomId, title } = useLocalSearchParams<{ roomId: string; title?: string }>();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (roomId && user) {
      loadMessages();
      markRead();
      setupRealtimeSubscription();
    }
  }, [roomId, user]);

  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(full_name, avatar_url)')
      .eq('room_id', roomId)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (data) {
      setMessages(data as any);
    }
    setLoading(false);
  }

  async function markRead() {
    try {
      await supabase.rpc('mark_messages_read', { p_room_id: roomId });
    } catch (err) {
      // Ignora erro não crítico de mark as read
    }
  }

  function setupRealtimeSubscription() {
    // Inscreve no canal realtime do Supabase para esta sala
    const channel = supabase
      .channel(`chat_room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          // Busca o perfil do sender para exibir nome/avatar
          const { data: senderData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const normalizedMsg: ChatMessageItem = {
            ...newMsg,
            sender: senderData || undefined,
          };

          setMessages((prev) => [normalizedMsg, ...prev]);

          if (newMsg.sender_id !== user?.id) {
            markRead();
          }
        }
      )
      .subscribe();

    return () => {
      // Cleanup de segurança da subscription
      supabase.removeChannel(channel);
    };
  }

  async function handleSend() {
    const trimmed = inputText.trim();
    if (!trimmed || !user || sending) return;

    if (trimmed.length > 2000) {
      return;
    }

    setSending(true);
    safeImpactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { error } = await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: user.id,
      body: trimmed,
    });

    if (!error) {
      setInputText('');
    }

    setSending(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={title || 'Chat In-App'} showBack />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <LoadingSpinner fullScreen message="Carregando conversa..." />
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.messagesList}
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;

              return (
                <View style={[styles.bubbleWrapper, isMine ? styles.myBubbleWrapper : styles.otherBubbleWrapper]}>
                  {!isMine && (
                    <Text style={styles.senderName}>{item.sender?.full_name || 'Usuário'}</Text>
                  )}
                  <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
                    <Text style={[styles.bubbleText, isMine ? styles.myBubbleText : styles.otherBubbleText]}>
                      {item.body}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor={colors.gray}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            <MaterialCommunityIcons name="send" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.default,
  },
  keyboardContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bubbleWrapper: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  myBubbleWrapper: {
    alignSelf: 'flex-end',
  },
  otherBubbleWrapper: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 10,
    color: colors.gray,
    marginBottom: 2,
    marginLeft: spacing.xs,
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  myBubble: {
    backgroundColor: colors.cyan,
    borderBottomRightRadius: radius.xs,
  },
  otherBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  bubbleText: {
    fontSize: typography.sizes.base,
    lineHeight: 20,
  },
  myBubbleText: {
    color: colors.white,
  },
  otherBubbleText: {
    color: colors.black,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.bg.input,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.black,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.bg.skeleton,
  },
});
