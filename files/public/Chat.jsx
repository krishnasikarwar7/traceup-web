import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * Chat.jsx
 *
 * Simple React chat component using Supabase Realtime (postgres_changes).
 * Expects backend endpoints:
 *   GET  /api/chat/realtime-auth
 *   GET  /api/chat/conversations/:id
 *   GET  /api/chat/conversations/:id/messages
 *   POST /api/chat/conversations/:id/messages
 *   PATCH /api/chat/conversations/:id/read
 */
export default function Chat({ conversationId, apiToken }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [me, setMe] = useState(null);
  const [cfg, setCfg] = useState(null);
  const bottomRef = useRef(null);

  const api = useMemo(() => async (method, endpoint, body) => {
    const res = await fetch(`/api${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }, [apiToken]);

  useEffect(() => {
    (async () => {
      const [convRes, msgRes, realtimeRes] = await Promise.all([
        api('GET', `/chat/conversations/${conversationId}`),
        api('GET', `/chat/conversations/${conversationId}/messages`),
        api('GET', '/chat/realtime-auth'),
      ]);
      if (convRes?.success) setConversation(convRes.data);
      if (msgRes?.success) setMessages(msgRes.data || []);
      if (realtimeRes?.success) setCfg(realtimeRes.data);
      const local = JSON.parse(localStorage.getItem('clf_user') || 'null');
      setMe(local);
      await api('PATCH', `/chat/conversations/${conversationId}/read`);
    })();
  }, [api, conversationId]);

  useEffect(() => {
    if (!cfg) return undefined;
    const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    supabase.realtime.setAuth(cfg.realtimeToken);

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cfg, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const content = draft.trim();
    if (!content) return;
    const res = await api('POST', `/chat/conversations/${conversationId}/messages`, { content });
    if (res?.success) setDraft('');
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h2>Item: {conversation?.item_title || '...'}</h2>
        <div>Location: {conversation?.item_location || '—'}</div>
        <div>Finder: {conversation?.finder_name || '—'}</div>
      </div>

      <div style={{ minHeight: 320, maxHeight: 420, overflowY: 'auto', border: '1px solid #ccc', padding: 12 }}>
        {messages.map((m) => {
          const mine = me && String(m.sender_id) === String(me.id);
          return (
            <div key={m.id} style={{ textAlign: mine ? 'right' : 'left', marginBottom: 10 }}>
              <div>{m.content}</div>
              <small>{mine ? (m.read ? '✓✓ seen' : '✓ sent') : ''}</small>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message"
          style={{ flex: 1 }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
