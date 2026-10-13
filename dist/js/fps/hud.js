/** DOM heads-up display. Reads snapshots, never mutates them. */
import {INGREDIENTS, RECIPES} from '../core.js';
import {heldLabel, planDrop} from './interactions.js';

const $ = id => document.getElementById(id);
const fmt = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const recipeOf = order => RECIPES.find(r => r.id === order.recipeId);
const TOAST_MS = 3200;

/** The core speaks in 2D button terms; reword those few lines for walking around. */
const FIRST_PERSON_WORDING = [
  ['Click Collect pizza.', 'Take it out of the oven.'],
  ['Click Collect patty.', 'Pick it up from the griddle.'],
  ['Click Cooked patty to add it to your burger.', 'Carry it to the burger board.'],
  ['Click Grill a patty first.', 'Put a raw patty on the griddle first.'],
];
export const firstPersonMessage = text => FIRST_PERSON_WORDING.reduce((t, [from, to]) => t.replace(from, to), text);

/** Ticket data shared by the HUD list and the in-world ticket rail. */
export function ticketView(state, order, ctx = {}) {
  if (!order) return null;
  const r = recipeOf(order), dish = state[r.type];
  const critic = ctx.criticOrderId === order.id;
  return {
    id: order.id, name: `${critic ? '★ ' : ''}${r.name}`, icon: r.type === 'pizza' ? '🍕' : '🍔', critic,
    selected: state.selectedOrder === order.id, urgent: state.mode === 'shift' && order.remaining < 25,
    patience: state.mode === 'practice' ? 'No rush' : `${Math.max(0, Math.ceil(order.remaining))}s left`,
    ingredients: r.ingredients.map(i => `${dish.ingredients.includes(i) ? '✓' : '○'} ${INGREDIENTS[i].name}`),
  };
}

export function createHud() {
  let ordersKey = '', eventsKey = '', playersKey = '';

  function renderOrders(state, ctx) {
    const views = state.orders.map(o => ticketView(state, o, ctx));
    const key = JSON.stringify(views);
    if (key === ordersKey) return;
    ordersKey = key;
    $('orders').innerHTML = views.map((v, i) => `
      <div class="order ${v.selected ? 'selected' : ''} ${v.critic ? 'critic' : ''}">
        <header><span>${v.icon} ${escapeHtml(v.name)}</span><span class="patience ${v.urgent ? 'urgent' : ''}">${escapeHtml(v.patience)}</span></header>
        ${v.selected ? `<ul>${v.ingredients.map(l => `<li class="${l.startsWith('✓') ? 'done' : ''}">${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
        <small>#${String(v.id).padStart(3, '0')} · press ${i + 1}</small>
      </div>`).join('');
  }

  function renderEvents(events) {
    const active = events?.active ?? [];
    const key = JSON.stringify(active.map(e => [e.id, e.title, e.remaining === null ? null : Math.ceil(e.remaining)]));
    if (key === eventsKey) return;
    eventsKey = key;
    $('events').innerHTML = active.map(e => `
      <div class="event ${e.type}">
        <b>${escapeHtml(e.title)}${e.remaining !== null ? ` · ${Math.max(0, Math.ceil(e.remaining))}s` : ''}</b>
        <span>${escapeHtml(e.detail)}</span>
      </div>`).join('');
  }

  function renderPlayers(players, selfId, online) {
    const key = online ? JSON.stringify(players.map(p => [p.id, p.name, p.color, p.held?.kind ?? ''])) : '';
    if (key === playersKey) return;
    playersKey = key;
    $('players').hidden = !online;
    $('players').innerHTML = online ? players.map(p => `
      <div><i style="background:${escapeHtml(p.color)}"></i><b>${escapeHtml(p.name)}${p.id === selfId ? ' (you)' : ''}</b><span>${escapeHtml(heldLabel(p.held))}</span></div>`).join('') : '';
  }

  return {
    render(snap, selfId, interaction, online) {
      const s = snap.game;
      const me = snap.players.find(p => p.id === selfId);
      const held = me?.held ?? null;
      $('mode-label').textContent = s.mode === 'shift' ? 'Time left' : 'Practice';
      $('clock').textContent = fmt(s.mode === 'shift' ? Math.ceil(s.remaining) : s.elapsed);
      $('score').textContent = s.score;
      $('revenue').textContent = `¥${s.revenue}`;
      $('served').textContent = s.served;
      $('held').textContent = heldLabel(held);
      $('drop-hint').textContent = planDrop(held) ? `Q: ${planDrop(held).label.toLowerCase()}` : '';
      const prompt = $('prompt');
      prompt.innerHTML = interaction ? `${interaction.enabled ? '<kbd>E</kbd>' : ''}${escapeHtml(interaction.label)}` : '';
      prompt.classList.toggle('disabled', Boolean(interaction && !interaction.enabled));
      $('crosshair').classList.toggle('active', Boolean(interaction?.enabled));
      const message = $('message');
      message.textContent = firstPersonMessage(s.message);
      message.className = `message ${s.messageType}`;
      renderOrders(s, snap.ctx);
      renderEvents(snap.events);
      renderPlayers(snap.players, selfId, online);
    },
    /** A short floating notice: tips, bonuses, joins. tone: info | good | bad. */
    toast(text, tone = 'info') {
      const el = document.createElement('div');
      el.className = `toast ${tone}`;
      el.textContent = text;
      $('toasts').append(el);
      setTimeout(() => el.classList.add('out'), TOAST_MS - 400);
      setTimeout(() => el.remove(), TOAST_MS);
    },
    showSummary(state, best) {
      $('summary-stats').innerHTML = `<div><b>¥${state.revenue}</b><span>Revenue</span></div><div><b>${state.served}</b><span>Served</span></div><div><b>${state.score}</b><span>Score</span></div>`;
      $('best-score').textContent = `Best: ${best} points · Missed: ${state.missed} orders`;
    },
    resetCache() { ordersKey = ''; eventsKey = ''; playersKey = ''; },
  };
}
