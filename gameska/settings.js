/* ---------------- settings.js ----------------
   Simple settings panel. Exposes `settings` object and fires `settingsChanged`.
*/
const settings = {
  pixelSize: 32,
  gravity: 0.001,
  initialColors: { red:true, blue:true, green:true }
};

function openSettings(){
  document.getElementById('pixelSizeInput').value = settings.pixelSize;
  document.getElementById('gravityInput').value = settings.gravity;
  document.getElementById('colorRed').checked = !!settings.initialColors.red;
  document.getElementById('colorBlue').checked = !!settings.initialColors.blue;
  document.getElementById('colorGreen').checked = !!settings.initialColors.green;
  document.getElementById('settings-window').classList.remove('hidden');
}

function closeSettings(){
  document.getElementById('settings-window').classList.add('hidden');
}

document.getElementById('openSettings').addEventListener('click', openSettings);
document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const ps = parseInt(document.getElementById('pixelSizeInput').value, 10);
  const grav = parseFloat(document.getElementById('gravityInput').value);
  settings.pixelSize = isNaN(ps) ? settings.pixelSize : ps;
  settings.gravity = isNaN(grav) ? settings.gravity : grav;
  settings.initialColors.red = document.getElementById('colorRed').checked;
  settings.initialColors.blue = document.getElementById('colorBlue').checked;
  settings.initialColors.green = document.getElementById('colorGreen').checked;
  closeSettings();
  // inform the game about change
  window.dispatchEvent(new CustomEvent('settingsChanged', { detail: JSON.parse(JSON.stringify(settings)) }));
});
