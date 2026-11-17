// The only DOM screens in the game: the title card (New Game / Continue / Settings) and the pause
// menu (Resume / Save & Quit / Settings), both built into the #overlay div from index.html's CSS
// classes. main.js owns all game state; this module only renders a screen and calls back out.
export function createUI(overlay) {
  function clear() { overlay.innerHTML = ''; overlay.classList.remove('hidden'); }
  function hide() { overlay.classList.add('hidden'); overlay.innerHTML = ''; }

  function settingsRows(settings, onChange) {
    const wrap = document.createElement('div');
    const volRow = document.createElement('div');
    volRow.className = 'row';
    volRow.innerHTML = '<span>Volume</span>';
    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = String(Math.round(settings.volume * 100));
    vol.addEventListener('input', () => onChange({ volume: Number(vol.value) / 100 }));
    volRow.appendChild(vol);
    const senRow = document.createElement('div');
    senRow.className = 'row';
    senRow.innerHTML = '<span>Mouse sensitivity</span>';
    const sen = document.createElement('input');
    sen.type = 'range'; sen.min = '20'; sen.max = '200'; sen.value = String(Math.round(settings.sensitivity * 100));
    sen.addEventListener('input', () => onChange({ sensitivity: Number(sen.value) / 100 }));
    senRow.appendChild(sen);
    wrap.appendChild(volRow);
    wrap.appendChild(senRow);
    return wrap;
  }

  function button(label, { primary = false, disabled = false } = {}) {
    const b = document.createElement('button');
    b.className = 'btn' + (primary ? ' primary' : '');
    b.textContent = label;
    b.disabled = disabled;
    return b;
  }

  function showTitle({ hasSave, settings, onNewGame, onContinue, onSettingsChange }) {
    clear();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h1>COSTA AURELIA</h1>
      <p class="tag">A sun-bleached coast. Amber Court runs the docks; the Solstice Board runs everything else.
      Nico Rivas just needs a way out — and a way to get paid first.</p>`;
    const newGame = button('New Game', { primary: true });
    newGame.addEventListener('click', onNewGame);
    const cont = button('Continue', { disabled: !hasSave });
    if (hasSave) cont.addEventListener('click', onContinue);
    panel.appendChild(newGame);
    panel.appendChild(cont);
    panel.appendChild(settingsRows(settings, onSettingsChange));
    const hints = document.createElement('div');
    hints.className = 'hints';
    hints.innerHTML = [
      'WASD move · Shift sprint · Mouse look (click to lock)',
      'F or E to enter / exit a vehicle · Space handbrake',
      'Left click to punch or fire · R reload · 1 fists · 2 flare pistol',
      'Esc to pause',
    ].map((l) => `<div>${l}</div>`).join('');
    panel.appendChild(hints);
    overlay.appendChild(panel);
    // Put keyboard focus on the primary action so the title is operable with Enter alone, no mouse.
    newGame.focus();
  }

  function showPause({ settings, onResume, onSaveQuit, onSettingsChange }) {
    clear();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = '<h1 style="font-size:22px;">PAUSED</h1>';
    const resume = button('Resume', { primary: true });
    resume.addEventListener('click', onResume);
    const quit = button('Save & Quit to Title');
    quit.addEventListener('click', onSaveQuit);
    panel.appendChild(resume);
    panel.appendChild(quit);
    panel.appendChild(settingsRows(settings, onSettingsChange));
    overlay.appendChild(panel);
    resume.focus();
  }

  return { showTitle, showPause, hide };
}
