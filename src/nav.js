// 導覽狀態機：island → interior → card。轉場中（busy）忽略所有操作。
export function createNav() {
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn(nav));
  const nav = {
    state: 'island',
    card: null,
    busy: false,
    enter() {
      if (nav.busy || nav.state !== 'island') return;
      nav.state = 'interior';
      emit();
    },
    open(key) {
      if (nav.busy || nav.state === 'island') return;
      if (nav.state === 'card' && nav.card === key) return;
      nav.state = 'card';
      nav.card = key;
      emit();
    },
    back() {
      if (nav.busy || nav.state === 'island') return;
      if (nav.state === 'card') { nav.state = 'interior'; nav.card = null; }
      else nav.state = 'island';
      emit();
    },
    beginTransition() { nav.busy = true; },
    endTransition() { nav.busy = false; },
    onChange(fn) { listeners.push(fn); },
  };
  return nav;
}
