/** Minimal tween runner: each tween gets eased progress 0..1 every frame. */
export const easeOutCubic = t => 1 - (1 - t) ** 3;
export const easeInOut = t => (t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createTweens() {
  let tweens = [];
  return {
    /** add({duration, update(t), done?, ease?}) */
    add(tween) {
      tweens = [...tweens, {elapsed: 0, ease: easeOutCubic, ...tween}];
    },
    update(dt) {
      const finished = [];
      for (const tween of tweens) {
        tween.elapsed += dt;
        const t = Math.min(1, tween.elapsed / tween.duration);
        tween.update(tween.ease(t));
        if (t >= 1) finished.push(tween);
      }
      if (!finished.length) return;
      tweens = tweens.filter(t => !finished.includes(t));
      for (const tween of finished) tween.done?.();
    },
  };
}
