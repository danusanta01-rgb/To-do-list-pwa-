/* ============================================================
   app.js — To-Do List Application
   Features: CRUD, localStorage persistence, datetime due dates,
             filter tabs, stats, Web Speech API notifications.
   ============================================================ */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  tasks: [],        // [{ id, text, datetime, done }]
  filter: 'all',    // 'all' | 'pending' | 'done'
  notifEnabled: false,
  voiceGender: 'female',
  voiceURI: '',
};

// ─── DOM Refs ─────────────────────────────────────────────────────────────────

const taskInput      = document.getElementById('task-input');
const taskDatetime   = document.getElementById('task-datetime');
const addBtn         = document.getElementById('add-btn');
const taskList       = document.getElementById('task-list');
const emptyState     = document.getElementById('empty-state');
const statsText      = document.getElementById('stats-text');
const clearDoneBtn   = document.getElementById('clear-done-btn');
const notifToggle    = document.getElementById('notif-toggle');
const voiceSettings  = document.getElementById('voice-settings');
const voiceNameRow   = document.getElementById('voice-name-row');
const voiceSelect    = document.getElementById('voice-select');
const testVoiceBtn   = document.getElementById('test-voice-btn');
const tabs           = document.querySelectorAll('.tab');
const voiceGenderBtns = document.querySelectorAll('input[name="voice-gender"]');

// ─── localStorage Helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'todo_app_v1';

function saveToStorage() {
  const data = {
    tasks:        state.tasks,
    notifEnabled: state.notifEnabled,
    voiceGender:  state.voiceGender,
    voiceURI:     state.voiceURI,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.tasks))  state.tasks        = data.tasks;
    if (data.notifEnabled != null)  state.notifEnabled = data.notifEnabled;
    if (data.voiceGender)           state.voiceGender  = data.voiceGender;
    if (data.voiceURI)              state.voiceURI     = data.voiceURI;
  } catch (_) { /* corrupt data — start fresh */ }
}

// ─── Task Operations ──────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    taskInput.classList.add('shake');
    setTimeout(() => taskInput.classList.remove('shake'), 400);
    return;
  }

  const task = {
    id:       generateId(),
    text,
    datetime: taskDatetime.value || null,
    done:     false,
  };

  state.tasks.unshift(task);
  taskInput.value    = '';
  taskDatetime.value = '';
  saveToStorage();
  render();

  if (state.notifEnabled) {
    speak(`Tugas baru ditambahkan: ${text}`);
  }
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveToStorage();
  render();

  if (state.notifEnabled && task.done) {
    speak(`Selesai: ${task.text}`);
  }
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveToStorage();
  render();
}

function clearDone() {
  state.tasks = state.tasks.filter(t => !t.done);
  saveToStorage();
  render();
}

// ─── Filtering ────────────────────────────────────────────────────────────────

function getFilteredTasks() {
  switch (state.filter) {
    case 'pending': return state.tasks.filter(t => !t.done);
    case 'done':    return state.tasks.filter(t =>  t.done);
    default:        return state.tasks;
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function formatDatetime(dtStr) {
  if (!dtStr) return null;
  const dt = new Date(dtStr);
  return dt.toLocaleString('id-ID', {
    weekday: 'short', day: '2-digit',
    month:   'short', year: 'numeric',
    hour:    '2-digit', minute: '2-digit',
  });
}

function isOverdue(dtStr) {
  if (!dtStr) return false;
  return new Date(dtStr) < new Date();
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.done ? ' done' : ''}`;
  li.dataset.id = task.id;

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked   = task.done;
  checkbox.setAttribute('aria-label', `Tandai "${task.text}" selesai`);
  checkbox.addEventListener('change', () => toggleTask(task.id));

  // Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const textEl = document.createElement('span');
  textEl.className = 'task-text';
  textEl.textContent = task.text;
  body.appendChild(textEl);

  if (task.datetime) {
    const due = document.createElement('div');
    due.className = `task-due${isOverdue(task.datetime) && !task.done ? ' overdue' : ''}`;
    due.textContent = `⏰ ${formatDatetime(task.datetime)}${isOverdue(task.datetime) && !task.done ? ' • Terlambat!' : ''}`;
    body.appendChild(due);
  }

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon-only';
  delBtn.setAttribute('aria-label', `Hapus "${task.text}"`);
  delBtn.innerHTML = '🗑';
  delBtn.addEventListener('click', () => deleteTask(task.id));

  li.append(checkbox, body, delBtn);
  return li;
}

function render() {
  const filtered = getFilteredTasks();
  taskList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    const frag = document.createDocumentFragment();
    filtered.forEach(task => frag.appendChild(createTaskElement(task)));
    taskList.appendChild(frag);
  }

  // Update stats
  const pending = state.tasks.filter(t => !t.done).length;
  statsText.textContent = `${pending} tugas tersisa`;

  // Sync filter tabs
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === state.filter);
  });

  // Sync settings UI
  notifToggle.checked = state.notifEnabled;
  voiceSettings.style.opacity  = state.notifEnabled ? '1' : '.45';
  voiceSettings.style.pointerEvents = state.notifEnabled ? 'auto' : 'none';
  voiceNameRow.style.opacity   = state.notifEnabled ? '1' : '.45';
  voiceNameRow.style.pointerEvents  = state.notifEnabled ? 'auto' : 'none';

  voiceGenderBtns.forEach(btn => {
    btn.checked = btn.value === state.voiceGender;
  });
}

// ─── Web Speech API ───────────────────────────────────────────────────────────

let voices = [];

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  populateVoiceSelect();
}

function populateVoiceSelect() {
  const gender   = state.voiceGender;
  const langPref = ['id', 'ID', 'en'];   // prefer Bahasa Indonesia voices first

  // Heuristic: female voices often have "female" in name, or "Zira","Google UK","Samantha"
  const femaleHints = /female|woman|wanita|zira|samantha|google uk|aria|susan|hazel|moira|veena|fiona|karen|tessa|victoria/i;
  const maleHints   = /male|man|pria|david|mark|richard|tom|alex|daniel|reed|luca|rishi|oliver/i;

  let filtered = voices.filter(v => {
    const isFemale = femaleHints.test(v.name) || (!maleHints.test(v.name));
    return gender === 'female' ? isFemale : maleHints.test(v.name);
  });

  // If no gender-filtered voices found, show all
  if (filtered.length === 0) filtered = voices;

  // Sort: Bahasa Indonesia first
  filtered.sort((a, b) => {
    const aLang = langPref.findIndex(l => a.lang.includes(l));
    const bLang = langPref.findIndex(l => b.lang.includes(l));
    const aIdx  = aLang === -1 ? 99 : aLang;
    const bIdx  = bLang === -1 ? 99 : bLang;
    return aIdx - bIdx;
  });

  voiceSelect.innerHTML = '';
  filtered.forEach(v => {
    const opt = document.createElement('option');
    opt.value       = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (v.voiceURI === state.voiceURI) opt.selected = true;
    voiceSelect.appendChild(opt);
  });

  // Auto-select first if saved voiceURI not in list
  if (voiceSelect.options.length && !filtered.find(v => v.voiceURI === state.voiceURI)) {
    state.voiceURI = filtered[0]?.voiceURI ?? '';
    voiceSelect.value = state.voiceURI;
    saveToStorage();
  }
}

function getSelectedVoice() {
  return voices.find(v => v.voiceURI === (voiceSelect.value || state.voiceURI)) || null;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter   = new SpeechSynthesisUtterance(text);
  const voice   = getSelectedVoice();
  if (voice) utter.voice = voice;
  utter.lang    = voice?.lang ?? 'id-ID';
  utter.rate    = 1;
  utter.pitch   = 1;
  window.speechSynthesis.speak(utter);
}

// ─── Due-Date Alarm Checker ───────────────────────────────────────────────────

function checkDueAlarms() {
  if (!state.notifEnabled) return;
  const now = new Date();
  state.tasks.forEach(task => {
    if (task.done || !task.datetime) return;
    const due = new Date(task.datetime);
    const diffMs = due - now;
    // Notify within ±30 seconds window (checked every minute)
    if (diffMs >= 0 && diffMs <= 30_000) {
      speak(`Pengingat: ${task.text} sudah jatuh tempo!`);
    }
  });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

addBtn.addEventListener('click', addTask);

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    state.filter = tab.dataset.filter;
    render();
  });
});

clearDoneBtn.addEventListener('click', clearDone);

notifToggle.addEventListener('change', () => {
  state.notifEnabled = notifToggle.checked;
  saveToStorage();
  render();
});

voiceGenderBtns.forEach(btn => {
  btn.addEventListener('change', () => {
    state.voiceGender = btn.value;
    populateVoiceSelect();
    saveToStorage();
  });
});

voiceSelect.addEventListener('change', () => {
  state.voiceURI = voiceSelect.value;
  saveToStorage();
});

testVoiceBtn.addEventListener('click', () => {
  speak('Halo! Ini adalah uji coba suara notifikasi To-Do List Anda.');
});

// Load voices — Chrome fires onvoiceschanged; Firefox has them immediately
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices(); // immediate call for Firefox / Safari
}

// Shake animation (CSS keyframe injected via JS for simplicity)
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
  .shake { animation: shake .4s ease; }
`;
document.head.appendChild(shakeStyle);

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadFromStorage();
render();

// Check due alarms every 30 seconds
setInterval(checkDueAlarms, 30_000);
