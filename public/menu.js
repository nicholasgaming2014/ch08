// Slide-out menu shared by every page.
const menuButton = document.querySelector('.menu-button');
const menu = document.getElementById('menu');
const overlay = document.querySelector('.menu-overlay');

function setMenu(open) {
  menu.classList.toggle('open', open);
  overlay.hidden = !open;
  menuButton.setAttribute('aria-expanded', open);
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

menuButton.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
overlay.addEventListener('click', () => setMenu(false));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
