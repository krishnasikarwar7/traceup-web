/**
 * public/chat.js
 *
 * Finder <-> claimer private chat page logic.
 */

'use strict';

(() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const chatMessagesEl = $('#chatMessages');
  if (!chatMessagesEl) return;

  const isAdminPage = !!document.querySelector('main[data-admin-chat="1"]');
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
  const API_BASE = isLocal && window.location.port !== '3000'
    ? 'http://localhost:3000/api'
    : `${window.location.origin}/api`;

  const authToken = localStorage.getItem('clf_token');
  const authUser = (() => {
    try { return JSON.parse(localStorage.getItem('clf_user')); } catch { return null; }
  })();

  if (!authToken || !authUser) {
    location.href = 'login.html';
    return;
  }
  if (isAdminPage && authUser.role !== 'admin') {
    location.href = 'dashboard.html';
    return;
  }

  const state = {
    conversations: [],
    activeConversation: null,
    messages: [],
    messageIds: new Set(),
    realtimeConfig: null,
    supabaseClient: null,
    channel: null,
  };

  const inputEl = $('#chatInput');
  const sendBtn = $('#chatSendBtn');
  const composerEl = $('#chatComposer');
  const listEl = $('#chatConversationList');

  if (isAdminPage && composerEl) {
    composerEl.classList.add('is-readonly');
    if (inputEl) {
      inputEl.value = '';
      inputEl.disabled = true;
      inputEl.placeholder = 'Admin review mode (read-only)';
    }
    if (sendBtn) sendBtn.disabled = true;
  }

  const notify = (msg, type = 'info') => {
    if (typeof window.toast === 'function') {
      window.toast(msg, type);
      return;
    }
    // eslint-disable-next-line no-alert
    alert(msg);
  };

  const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const initialConversationId = (() => {
    const pathMatch = window.location.pathname.match(/^\/chat\/([0-9a-f-]{10,})$/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const q = new URLSearchParams(window.location.search);
    return q.get('conversationId') || q.get('id') || null;
  })();

  const api = async (method, endpoint, body = null) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    if (body) headers['Content-Type'] = 'application/json';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (res.status === 401) {
        localStorage.removeItem('clf_token');
        localStorage.removeItem('clf_user');
        location.href = 'login.html';
        return null;
      }
      return { ok: res.ok, status: res.status, ...data };
    } catch (err) {
      console.error(err);
      notify('Network error while loading chat.', 'error');
      return null;
    }
  };

  const setHeader = (conversation) => {
    $('#chatItemTitle').textContent = conversation?.item_title || 'Conversation';
    $('#chatHeaderLine1').textContent = conversation
      ? `Item: ${conversation.item_title || 'Unknown'}  •  Location: ${conversation.item_location || '—'}`
      : 'Item details appear here.';
    $('#chatHeaderLine2').textContent = conversation
      ? `Finder: ${conversation.finder_name || '—'}  •  Claimer: ${conversation.claimer_name || '—'}`
      : '';
  };

  const renderConversationList = () => {
    if (!state.conversations.length) {
      listEl.innerHTML = '<div class="text-sm text-muted">No conversations yet.</div>';
      return;
    }

    listEl.innerHTML = state.conversations.map((c) => {
      const isActive = state.activeConversation?.id === c.id;
      const who = authUser.id === c.finder_id ? `with ${c.claimer_name || 'claimer'}` : `with ${c.finder_name || 'finder'}`;
      const snippet = c.last_message?.content
        ? c.last_message.content.slice(0, 54)
        : 'No messages yet';
      const when = c.last_message?.created_at
        ? fmtDate(c.last_message.created_at)
        : fmtDate(c.created_at);

      return `
        <button class="chat-list-item ${isActive ? 'active' : ''}" data-conversation-id="${c.id}">
          <div class="title">${escapeHtml(c.item_title || 'Item chat')}</div>
          <div class="meta">${escapeHtml(who)} • ${escapeHtml(when)}</div>
          <div class="meta" style="margin-top:4px;">${escapeHtml(snippet)}</div>
        </button>
      `;
    }).join('');
  };

  const renderMessages = () => {
    if (!state.messages.length) {
      chatMessagesEl.innerHTML = '<div class="text-sm text-muted">No messages yet. Start the conversation.</div>';
      return;
    }

    let lastDate = '';
    const html = [];

    for (const msg of state.messages) {
      const dateLabel = fmtDate(msg.created_at);
      if (dateLabel !== lastDate) {
        html.push(`<div class="chat-day">${escapeHtml(dateLabel)}</div>`);
        lastDate = dateLabel;
      }

      const mine = String(msg.sender_id) === String(authUser.id);
      const senderName = mine ? 'You' : (msg.sender_name || 'User');
      const seen = mine ? (msg.read ? '✓✓ seen' : '✓ sent') : '';
      html.push(`
        <div class="msg ${mine ? 'me' : ''}" data-message-id="${msg.id}">
          <div class="who">${escapeHtml(senderName)}</div>
          <div class="content">${escapeHtml(msg.content)}</div>
          <div class="meta">${escapeHtml(fmtTime(msg.created_at))}${seen ? ` • ${escapeHtml(seen)}` : ''}</div>
        </div>
      `);
    }

    chatMessagesEl.innerHTML = html.join('');
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  };

  const syncMessageIds = () => {
    state.messageIds = new Set(state.messages.map((m) => m.id));
  };

  const updateSeenStatus = (messageId, readValue) => {
    const idx = state.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    state.messages[idx] = { ...state.messages[idx], read: readValue };
    renderMessages();
  };

  const markRead = async () => {
    if (!state.activeConversation) return;
    await api('PATCH', `/chat/conversations/${state.activeConversation.id}/read`);
  };

  const conversationById = (id) => state.conversations.find((c) => c.id === id) || null;

  const toRealtimeMessage = (row) => {
    if (!row) return null;
    const active = state.activeConversation;
    const senderName = row.sender_name
      || (active && String(row.sender_id) === String(active.finder_id) ? active.finder_name : null)
      || (active && String(row.sender_id) === String(active.claimer_id) ? active.claimer_name : null)
      || 'User';

    return {
      ...row,
      sender_name: senderName,
    };
  };

  const appendMessage = (message) => {
    if (!message || state.messageIds.has(message.id)) return;
    state.messages.push(message);
    state.messageIds.add(message.id);
    renderMessages();
  };

  const ensureRealtime = async () => {
    if (state.realtimeConfig || !window.supabase?.createClient) return state.realtimeConfig;

    const cfgRes = await api('GET', '/chat/realtime-auth');
    if (!cfgRes?.ok) return null;

    state.realtimeConfig = cfgRes.data;
    state.supabaseClient = window.supabase.createClient(
      cfgRes.data.supabaseUrl,
      cfgRes.data.supabaseAnonKey
    );
    if (state.supabaseClient?.realtime?.setAuth) {
      state.supabaseClient.realtime.setAuth(cfgRes.data.realtimeToken);
    }
    return state.realtimeConfig;
  };

  const subscribeToConversation = async (conversationId) => {
    if (!conversationId) return;
    await ensureRealtime();
    if (!state.supabaseClient) return;

    if (state.channel) {
      state.supabaseClient.removeChannel(state.channel);
      state.channel = null;
    }

    state.channel = state.supabaseClient
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const message = toRealtimeMessage(payload.new);
        appendMessage(message);
        if (String(message.sender_id) !== String(authUser.id)) {
          await markRead();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        if (payload.new?.id) updateSeenStatus(payload.new.id, payload.new.read);
      })
      .subscribe();
  };

  const openConversation = async (conversationId, { replaceHistory = true } = {}) => {
    if (!conversationId) return;

    if (isAdminPage) {
      const res = await api('GET', `/admin/chats/${conversationId}/messages`);
      if (!res?.ok) {
        notify(res?.error || 'Could not load admin chat.', 'error');
        return;
      }
      state.activeConversation = res.data.conversation;
      state.messages = res.data.messages || [];
    } else {
      const [convRes, msgRes] = await Promise.all([
        api('GET', `/chat/conversations/${conversationId}`),
        api('GET', `/chat/conversations/${conversationId}/messages`),
      ]);

      if (!convRes?.ok) {
        notify(convRes?.error || 'Could not load conversation.', 'error');
        return;
      }
      if (!msgRes?.ok) {
        notify(msgRes?.error || 'Could not load messages.', 'error');
        return;
      }

      state.activeConversation = convRes.data;
      state.messages = msgRes.data || [];
      await markRead();
    }

    syncMessageIds();
    setHeader(state.activeConversation);
    renderConversationList();
    renderMessages();

    if (!isAdminPage) {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }

    if (!isAdminPage && replaceHistory) {
      history.replaceState({}, '', `/chat/${conversationId}`);
    }

    await subscribeToConversation(conversationId);
  };

  const loadConversations = async () => {
    listEl.innerHTML = '<div class="text-sm text-muted">Loading…</div>';
    const endpoint = isAdminPage ? '/admin/chats' : '/chat/my';
    const res = await api('GET', endpoint);
    if (!res?.ok) {
      listEl.innerHTML = `<div class="text-sm" style="color:var(--red);">${escapeHtml(res?.error || 'Failed to load conversations.')}</div>`;
      return;
    }

    state.conversations = res.data || [];
    renderConversationList();

    if (!state.conversations.length) {
      setHeader(null);
      return;
    }

    let targetId = initialConversationId;
    if (!targetId) targetId = state.conversations[0].id;
    if (!conversationById(targetId)) targetId = state.conversations[0].id;
    await openConversation(targetId, { replaceHistory: false });
  };

  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-conversation-id]');
    if (!btn) return;
    const id = btn.dataset.conversationId;
    if (!id || state.activeConversation?.id === id) return;
    await openConversation(id);
  });

  composerEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isAdminPage) return;
    if (!state.activeConversation) return;
    const content = inputEl.value.trim();
    if (!content) return;

    sendBtn.disabled = true;

    const res = await api('POST', `/chat/conversations/${state.activeConversation.id}/messages`, { content });
    sendBtn.disabled = false;

    if (!res?.ok) {
      notify(res?.error || 'Failed to send message.', 'error');
      return;
    }

    inputEl.value = '';
    inputEl.focus();

    const newMessage = toRealtimeMessage(res.data);
    appendMessage(newMessage);
  });

  window.addEventListener('beforeunload', () => {
    if (state.supabaseClient && state.channel) {
      state.supabaseClient.removeChannel(state.channel);
    }
  });

  loadConversations();
})();
