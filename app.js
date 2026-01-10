// Demo user data and state (all in-memory)
const DEMO_USER = {
  username: 'jdoe',
  passwordHash: '37825f7b00b15794d24b8f8a362cc12ba530157e4c394319bb9b14009d1b2503', // Hash for '@ 123' (your input)
  accounts: [
    { iban: 'GB44 DEMO 0123 4567 89', name: 'Checking', balance: 4250.12 },
    { iban: 'GB44 DEMO 9876 5432 10', name: 'Savings', balance: 17000.00 }
  ],
  transactions: [
    { date: '2025-07-24', desc: 'ATM Deposit', amt: 2000, bal: 4250.12 },
    { date: '2025-07-21', desc: 'Groceries', amt: -75.62, bal: 2250.12 },
    { date: '2025-07-20', desc: 'Paycheck', amt: 2000, bal: 2325.74 }
  ]
};
let session = { user: null, otp: null, idleTimer: null };

// Utility: Simple SHA-256 hash.
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- UI Helper to flash feedback messages ---
function flashFeedback(el, message, isSuccess) {
  el.textContent = message;
  el.classList.toggle('success', Boolean(isSuccess));
  el.style.backgroundColor = isSuccess ? '#d3f7d3' : '#fff0f0';
  setTimeout(() => {
    el.textContent = '';
    el.classList.remove('success');
    el.style.backgroundColor = '';
  }, 1800);
}

// ---- Login and OTP ----
document.getElementById('login-form').onsubmit = async function (e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const feedback = document.getElementById('login-feedback');
  feedback.textContent = '';
  flashFeedback(feedback, 'Checking... ⏳', false);

  if (username !== DEMO_USER.username) {
    flashFeedback(feedback, 'Invalid username or password', false);
    return;
  }

  // Hash entered password
  const hashed = await sha256(password);
  if (hashed !== DEMO_USER.passwordHash) {
    flashFeedback(feedback, 'Invalid username or password', false);
    return;
  }

  // Generate OTP
  session.otp = String(Math.floor(100000 + Math.random() * 900000));
  session.tmpUser = username;

  // Hide login, show OTP
  document.getElementById('login-section').hidden = true;
  document.getElementById('otp-section').hidden = false;
  document.getElementById('otp-input').value = '';

  flashFeedback(document.getElementById('otp-feedback'), `Demo: use code ${session.otp}`, true);
};

// Toggle password visibility
document.getElementById('toggle-pw').onclick = function () {
  const pwInput = document.getElementById('login-password');
  if (pwInput.type === 'password') {
    pwInput.type = 'text';
    this.textContent = 'Hide';
    this.setAttribute('aria-label', 'Hide password');
  } else {
    pwInput.type = 'password';
    this.textContent = 'Show';
    this.setAttribute('aria-label', 'Show password');
  }
};

document.getElementById('otp-form').onsubmit = function (e) {
  e.preventDefault();
  const code = document.getElementById('otp-input').value.trim();
  const feedback = document.getElementById('otp-feedback');
  feedback.textContent = '';

  if (code !== session.otp) {
    flashFeedback(feedback, 'Invalid code', false);
    return;
  }

  // Create session user snapshots to avoid mutation
  session.user = { ...DEMO_USER };
  session.user.accounts = DEMO_USER.accounts.map((a) => ({ ...a }));
  session.user.transactions = DEMO_USER.transactions.slice();
  session.otp = null;

  document.getElementById('otp-section').hidden = true;
  loadDashboard();
};

// Load dashboard UI
function loadDashboard() {
  document.getElementById('dashboard-username').textContent = session.user.username;
  renderAccounts();
  renderTransactions();
  document.getElementById('dashboard').hidden = false;
  resetIdleTimeout();
}

// Render user's accounts
function renderAccounts() {
  const ul = document.getElementById('accounts-list');
  ul.innerHTML = '';
  session.user.accounts.forEach((ac) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${ac.name} (<small>${ac.iban.replace(/\s?\w{6}$/, ' ******')}</small>)</span>
      <b>₹${ac.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>`;
    li.title = `IBAN: ${ac.iban}\nBalance: ₹${ac.balance.toFixed(2)}`;
    li.onclick = () => showAccountDetails(ac);
    ul.appendChild(li);
  });

  // Populate 'from' account selector in transfer form
  const fromSel = document.getElementById('from-account');
  fromSel.innerHTML = '';
  session.user.accounts.forEach((ac) => {
    const opt = document.createElement('option');
    opt.value = ac.iban;
    opt.textContent = `${ac.name} – ₹${ac.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    fromSel.appendChild(opt);
  });
}

// Show account details in alert (simple modal can be implemented if preferred)
function showAccountDetails(acct) {
  alert(`Account Details:\nName: ${acct.name}\nIBAN: ${acct.iban}\nBalance: ₹${acct.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
}

// Render recent transactions (max 5)
function renderTransactions() {
  const tbody = document.getElementById('transactions-table').querySelector('tbody');
  tbody.innerHTML = '';
  session.user.transactions.slice(0, 5).forEach((tx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tx.date}</td>
      <td>${escapeHTML(tx.desc)}</td>
      <td class="amount ${tx.amt > 0 ? 'positive' : 'negative'}">${tx.amt > 0 ? '+' : '-'}₹${Math.abs(tx.amt).toFixed(2)}</td>
      <td>₹${tx.bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---- Transfers ----
document.getElementById('transfer-nav-btn').onclick = () => {
  document.getElementById('transfer-section').hidden = false;
  document.getElementById('billpay-section').hidden = true;
};
document.getElementById('billpay-nav-btn').onclick = () => {
  document.getElementById('transfer-section').hidden = true;
  document.getElementById('billpay-section').hidden = false;
};

document.getElementById('transfer-form').onsubmit = function (e) {
  e.preventDefault();
  const fromIban = document.getElementById('from-account').value;
  const toIban = document.getElementById('to-iban').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  const feedback = document.getElementById('transfer-feedback');
  feedback.textContent = '';

  if (!/^[A-Z0-9]{15,34}$/.test(toIban)) {
    flashFeedback(feedback, 'Invalid IBAN', false);
    return;
  }
  if (isNaN(amount) || amount < 1) {
    flashFeedback(feedback, 'Minimum transfer ₹1', false);
    return;
  }
  let from = session.user.accounts.find((a) => a.iban === fromIban);
  if (!from || from.balance < amount) {
    flashFeedback(feedback, 'Insufficient balance', false);
    return;
  }
  from.balance -= amount;
  session.user.transactions.unshift({
    date: new Date().toISOString().slice(0, 10),
    desc: `Transfer to ${toIban.slice(0, 6)}...`,
    amt: -amount,
    bal: from.balance,
  });

  flashFeedback(feedback, 'Transfer successful!', true);
  renderAccounts();
  renderTransactions();
  document.getElementById('transfer-form').reset();
};

// ---- Bill Pay ----
document.getElementById('billpay-form').onsubmit = function (e) {
  e.preventDefault();
  const company = document.getElementById('bill-company').value.trim();
  const amount = parseFloat(document.getElementById('bill-amount').value);
  const feedback = document.getElementById('billpay-feedback');
  feedback.textContent = '';
  let from = session.user.accounts[0];
  if (!company) {
    flashFeedback(feedback, 'Enter a company', false);
    return;
  }
  if (isNaN(amount) || amount < 1) {
    flashFeedback(feedback, 'Minimum bill ₹1', false);
    return;
  }
  if (from.balance < amount) {
    flashFeedback(feedback, 'Insufficient balance', false);
    return;
  }
  from.balance -= amount;
  session.user.transactions.unshift({
    date: new Date().toISOString().slice(0, 10),
    desc: `Bill Pay: ${company}`,
    amt: -amount,
    bal: from.balance,
  });

  flashFeedback(feedback, 'Bill paid!', true);
  renderAccounts();
  renderTransactions();
  document.getElementById('billpay-form').reset();
};

// ---- Profile ----
document.getElementById('profile-btn').onclick = function () {
  document.getElementById('profile-section').hidden = false;
  document.getElementById('profile-username').value = session.user.username;
  document.getElementById('profile-password').value = '';
  document.getElementById('pw-strength').textContent = '';
  document.getElementById('profile-feedback').textContent = '';
  document.getElementById('profile-password').focus();
};

document.getElementById('close-profile-btn').onclick = function () {
  document.getElementById('profile-section').hidden = true;
};

document.getElementById('profile-password').oninput = function () {
  const val = this.value;
  let strength = 'Weak';
  let ok = false;
  if (val.length >= 8 && /\d/.test(val) && /[!@#$%^&*]/.test(val)) {
    ok = true;
    strength = 'Strong';
  } else if (val.length >= 5 && /\d/.test(val)) {
    strength = 'Medium';
  }
  const msg = ok ? 'Strong password ✔' : `Strength: ${strength}`;
  const el = document.getElementById('pw-strength');
  el.textContent = msg;
  el.className = ok ? 'feedback success' : 'feedback';
};

document.getElementById('profile-form').onsubmit = async function (e) {
  e.preventDefault();
  const newpw = document.getElementById('profile-password').value;
  const feedback = document.getElementById('profile-feedback');
  if (newpw.length < 5) {
    flashFeedback(feedback, 'Password too short (min 5 chars)', false);
    return;
  }
  DEMO_USER.passwordHash = await sha256(newpw);
  flashFeedback(feedback, 'Password changed!', true);
  setTimeout(() => {
    document.getElementById('profile-section').hidden = true;
  }, 1200);
};

// ---- Logout/Timeout ----
document.getElementById('logout-btn').onclick = logout;

function resetIdleTimeout() {
  clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(logout, 600000); // Logout after 10 min idle
  window.onmousemove = window.onkeydown = resetIdleTimeout;
}

function logout() {
  session = { user: null, otp: null, idleTimer: null };
  document.getElementById('dashboard').hidden = true;
  document.getElementById('transfer-section').hidden = true;
  document.getElementById('billpay-section').hidden = true;
  document.getElementById('profile-section').hidden = true;
  document.getElementById('login-section').hidden = false;
  const feedback = document.getElementById('login-feedback');
  flashFeedback(feedback, 'You have been logged out.', true);
  window.onmousemove = window.onkeydown = null;
}

// -- Accessibility/dark mode/XSS --
document.getElementById('darkmode-toggle').onclick = function () {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark'));
};

if (localStorage.getItem('dark') === 'true') document.body.classList.add('dark');

// Sanitisation to prevent XSS in transaction descriptions
function escapeHTML(str) {
  return str.replace(/[<>&"']/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Initialize UI state on load
window.onload = function () {
  document.getElementById('login-section').hidden = false;
  document.getElementById('dashboard').hidden = true;
  document.getElementById('profile-section').hidden = true;
  document.getElementById('otp-section').hidden = true;
  document.getElementById('transfer-section').hidden = true;
  document.getElementById('billpay-section').hidden = true;
  document.getElementById('login-username').focus();
};
