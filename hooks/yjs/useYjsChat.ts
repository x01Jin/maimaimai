import { useState, useEffect, useCallback } from "react";
import * as Y from "yjs";
import { ChatMessage, Player } from "../../types";
import { generateUUID } from "../../utils/storage";
import { YJS_CONFIG } from "../../constants";

export interface UseYjsChatReturn {
  messages: ChatMessage[];
  sendMessage: (
    content: string,
    senderId: string,
    senderUuid: string,
    senderName: string,
    replyToId?: string,
    type?: "text" | "image" | "gif",
    metadata?: ChatMessage["metadata"],
  ) => void;
  addReaction: (messageId: string, playerId: string, emoji: string) => void;
  removeReaction: (messageId: string, playerId: string, emoji: string) => void;
  sendSystemMessage: (content: string) => void;
}

export function useYjsChat(ydoc: Y.Doc | null): UseYjsChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Sync messages from Y.Array
  useEffect(() => {
    if (!ydoc) return;

    const messagesArray = ydoc.getArray<ChatMessage>("messages");

    const syncMessages = () => {
      const allMessages = messagesArray.toArray();
      // Sort by timestamp and limit
      const sorted = [...allMessages].sort((a, b) => a.timestamp - b.timestamp);
      const limited = sorted.slice(-YJS_CONFIG.MAX_CHAT_HISTORY);
      setMessages(limited);
    };

    messagesArray.observe(syncMessages);
    syncMessages();

    return () => {
      messagesArray.unobserve(syncMessages);
    };
  }, [ydoc]);

  const sendMessage = useCallback(
    (
      content: string,
      senderId: string,
      senderUuid: string,
      senderName: string,
      replyToId?: string,
      type: "text" | "image" | "gif" = "text",
      metadata?: ChatMessage["metadata"],
    ) => {
      if (!ydoc || !content.trim()) return;

      const messagesArray = ydoc.getArray<ChatMessage>("messages");
      const modMap = ydoc.getMap("mod");
      const currentModId = modMap.get("modId") as string | undefined;

      const message: ChatMessage = {
        id: generateUUID(),
        senderId,
        senderUuid,
        senderName,
        content: content.trim(),
        timestamp: Date.now(),
        replyToId,
        reactions: {},
        senderIsMod: senderId === currentModId,
        type,
        metadata,
      };

      messagesArray.push([message]);

      // Trim if over limit
      if (messagesArray.length > YJS_CONFIG.MAX_CHAT_HISTORY) {
        const toRemove = messagesArray.length - YJS_CONFIG.MAX_CHAT_HISTORY;
        messagesArray.delete(0, toRemove);
      }
    },
    [ydoc],
  );

  const sendSystemMessage = useCallback(
    (content: string) => {
      if (!ydoc) return;

      const messagesArray = ydoc.getArray<ChatMessage>("messages");

      const message: ChatMessage = {
        id: generateUUID(),
        senderId: "system",
        senderName: "System",
        content,
        timestamp: Date.now(),
        isSystem: true,
      };

      messagesArray.push([message]);
    },
    [ydoc],
  );

  const addReaction = useCallback(
    (messageId: string, playerId: string, emoji: string) => {
      if (!ydoc) return;

      const messagesArray = ydoc.getArray<ChatMessage>("messages");
      const allMessages = messagesArray.toArray();
      const index = allMessages.findIndex((m) => m.id === messageId);

      if (index === -1) return;

      const message = allMessages[index];
      const reactions = { ...message.reactions };

      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      if (!reactions[emoji].includes(playerId)) {
        reactions[emoji] = [...reactions[emoji], playerId];

        const updatedMessage: ChatMessage = { ...message, reactions };

        ydoc.transact(() => {
          messagesArray.delete(index, 1);
          messagesArray.insert(index, [updatedMessage]);
        });
      }
    },
    [ydoc],
  );

  const removeReaction = useCallback(
    (messageId: string, playerId: string, emoji: string) => {
      if (!ydoc) return;

      const messagesArray = ydoc.getArray<ChatMessage>("messages");
      const allMessages = messagesArray.toArray();
      const index = allMessages.findIndex((m) => m.id === messageId);

      if (index === -1) return;

      const message = allMessages[index];
      const reactions = { ...message.reactions };

      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter((id) => id !== playerId);

        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }

        const updatedMessage: ChatMessage = { ...message, reactions };

        ydoc.transact(() => {
          messagesArray.delete(index, 1);
          messagesArray.insert(index, [updatedMessage]);
        });
      }
    },
    [ydoc],
  );

  return {
    messages,
    sendMessage,
    addReaction,
    removeReaction,
    sendSystemMessage,
  };
}
