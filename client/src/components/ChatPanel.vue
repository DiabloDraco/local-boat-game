<template>
  <div class="chat-panel" @click.self="closeEmoji">
    <div class="chat-header">
      <span class="chat-title">Чат</span>
      <span class="chat-dot" :class="{ active: messages.length > 0 }"></span>
    </div>

    <div class="chat-messages" ref="scrollEl" @click="closeEmoji">
      <div v-if="messages.length === 0" class="chat-empty">
        Напишите что-нибудь...
      </div>
      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="msg-row"
        :class="msg.mine ? 'mine' : 'theirs'"
      >
        <div class="msg-bubble">
          <span v-if="!msg.mine" class="msg-from">{{ msg.from }}</span>
          <span class="msg-text">{{ msg.text }}</span>
        </div>
      </div>
    </div>

    <!-- Emoji picker popup -->
    <Transition name="emoji-pop">
      <div v-if="showEmoji" class="emoji-picker">
        <div class="emoji-grid">
          <button
            v-for="e in EMOJIS"
            :key="e"
            class="emoji-btn"
            @click.stop="insertEmoji(e)"
          >{{ e }}</button>
        </div>
      </div>
    </Transition>

    <div class="chat-input-row">
      <button class="emoji-toggle" @click.stop="showEmoji = !showEmoji" title="Эмодзи">😊</button>
      <input
        ref="inputEl"
        v-model="draft"
        class="chat-input"
        placeholder="Сообщение..."
        maxlength="200"
        @keydown.enter.prevent="send"
        @focus="closeEmoji"
      />
      <button class="send-btn" @click="send" :disabled="!draft.trim()">➤</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import socket from '../socket.js'

const EMOJIS = [
  '😀','😂','😎','😭','😡','🤔','👍','👎',
  '🔥','💥','🎯','💣','⚓','🚢','💀','🏆',
  '😬','🤣','😤','🥳','😱','🤯','👏','✌️',
]

const messages  = ref([])
const draft     = ref('')
const scrollEl  = ref(null)
const inputEl   = ref(null)
const showEmoji = ref(false)

function scrollBottom() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

function closeEmoji() {
  showEmoji.value = false
}

function insertEmoji(e) {
  draft.value += e
  showEmoji.value = false
  inputEl.value?.focus()
}

function send() {
  const text = draft.value.trim()
  if (!text) return
  socket.emit('chat:message', { text })
  draft.value = ''
  inputEl.value?.focus()
}

onMounted(() => {
  socket.on('chat:incoming', ({ from, fromId, text }) => {
    messages.value.push({
      from,
      text,
      mine: fromId === socket.id,
    })
    scrollBottom()
  })
})

onUnmounted(() => {
  socket.off('chat:incoming')
})
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  width: 230px;
  flex-shrink: 0;
  background: var(--paper-white);
  border: 1.5px solid var(--line);
  border-radius: 3px;
  box-shadow: var(--shadow);
  overflow: visible;
  height: 480px;
  position: relative;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
  flex-shrink: 0;
  border-radius: 3px 3px 0 0;
}

.chat-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--ink-mid);
}

.chat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--line);
  margin-left: auto;
  transition: background 0.2s;
}
.chat-dot.active { background: var(--green); }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scroll-behavior: smooth;
}

.chat-empty {
  font-size: 12px;
  color: var(--ink-light);
  text-align: center;
  margin: auto;
  letter-spacing: 0.3px;
}

.msg-row {
  display: flex;
}
.msg-row.mine    { justify-content: flex-end; }
.msg-row.theirs  { justify-content: flex-start; }

.msg-bubble {
  max-width: 85%;
  padding: 6px 10px;
  border-radius: 3px;
  font-size: 13px;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 2px;
  word-break: break-word;
}

.mine .msg-bubble {
  background: rgba(44,95,138,0.12);
  border: 1px solid rgba(44,95,138,0.25);
  color: var(--ink);
}

.theirs .msg-bubble {
  background: var(--paper);
  border: 1px solid var(--line);
  color: var(--ink);
}

.msg-from {
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-light);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.msg-text {
  font-size: 13px;
}

/* Input row */
.chat-input-row {
  display: flex;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
  position: relative;
}

.emoji-toggle {
  background: var(--paper);
  border: none;
  border-right: 1px solid var(--line);
  padding: 0 10px;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
  line-height: 1;
}
.emoji-toggle:hover { background: var(--paper-dark); }

.chat-input {
  flex: 1;
  background: var(--paper);
  border: none;
  outline: none;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--ink);
  font-family: inherit;
  min-width: 0;
}
.chat-input::placeholder { color: var(--ink-light); }

.send-btn {
  background: var(--accent);
  border: none;
  color: #fff;
  padding: 0 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}
.send-btn:hover:not(:disabled) { background: var(--accent-light); }
.send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* Emoji picker */
.emoji-picker {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--paper-white);
  border: 1.5px solid var(--line);
  border-radius: 3px;
  box-shadow: var(--shadow-lg);
  padding: 8px;
  z-index: 50;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.emoji-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  transition: background 0.1s;
  line-height: 1;
  text-align: center;
}
.emoji-btn:hover { background: var(--paper-dark); }

/* Animation */
.emoji-pop-enter-active, .emoji-pop-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.emoji-pop-enter-from, .emoji-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
