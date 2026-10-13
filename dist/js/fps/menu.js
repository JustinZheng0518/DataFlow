/** Start, pause and summary screens. Turns button presses into callbacks. */
const $ = id => document.getElementById(id);
const NAME_KEY = 'sizzle-chef-name';
const OVERLAYS = ['start', 'paused', 'summary'];

function savedName() {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
function saveName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch (error) { console.warn('Could not remember chef name', error); }
}

export function createMenu(handlers) {
  $('name').value = savedName();
  const name = () => {
    const value = $('name').value.trim().slice(0, 16) || 'Chef';
    saveName(value);
    return value;
  };
  const guard = fn => async () => {
    $('start-error').textContent = '';
    try {
      await fn();
    } catch (error) {
      console.error('Menu action failed', error);
      $('start-error').textContent = error.message || 'Something went wrong. Please try again.';
      showOnly('start');
    }
  };
  const showOnly = id => OVERLAYS.forEach(o => { $(o).hidden = o !== id; });

  $('start-practice').onclick = guard(() => handlers.onSolo('practice', name()));
  $('start-shift').onclick = guard(() => handlers.onSolo('shift', name()));
  $('join').onclick = guard(async () => {
    $('join').disabled = true;
    $('join').textContent = 'Joining…';
    try {
      await handlers.onJoin(name());
    } finally {
      $('join').disabled = false;
      $('join').textContent = 'Join the shared kitchen';
    }
  });
  $('resume').onclick = () => handlers.onResume();
  $('restart-practice').onclick = $('to-practice').onclick = () => handlers.onRestart('practice');
  $('restart-shift').onclick = $('again').onclick = () => handlers.onRestart('shift');
  $('toggle-pause').onclick = () => handlers.onTogglePause();
  $('leave').onclick = () => handlers.onLeave();

  return {
    showStart() { showOnly('start'); $('hud').hidden = true; },
    hideAll() { showOnly(null); $('hud').hidden = false; },
    showPaused({online, kitchenPaused, players}) {
      showOnly('paused');
      $('pause-eyebrow').textContent = online ? 'SHARED KITCHEN' : 'ON A BREAK';
      $('pause-title').textContent = online ? (kitchenPaused ? 'The kitchen is paused' : 'The kitchen keeps cooking') : 'Kitchen timers are paused';
      $('pause-note').textContent = online ? `${players} chef${players === 1 ? '' : 's'} in the kitchen. Restarting starts a new round for everyone.` : '';
      $('restart-practice').textContent = online ? 'Practice for everyone' : 'Restart practice';
      $('restart-shift').textContent = online ? 'Shift for everyone' : 'New shift';
      $('toggle-pause').hidden = !online;
      $('toggle-pause').textContent = kitchenPaused ? 'Unpause for everyone' : 'Pause for everyone';
      $('leave').textContent = online ? 'Leave the kitchen' : 'Main menu';
    },
    showSummary() { showOnly('summary'); },
    isOpen: id => !$(id).hidden,
    /** Show whether a multiplayer server is reachable from this page. */
    setTogether(info) {
      $('join').disabled = !info;
      $('together-note').innerHTML = info
        ? `Up to ${info.maxPlayers} chefs share one kitchen. ${info.players} in there right now. Friends on the same Wi-Fi open this same address.`
        : 'To cook with friends, run <code>npm start</code> in the project folder and open the link it prints.';
    },
    setError(text) { $('start-error').textContent = text; },
  };
}
