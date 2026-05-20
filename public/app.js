const monthLabel = document.getElementById('monthLabel');
const calendarEl = document.getElementById('calendar');
const messageEl = document.getElementById('message');
const selectedDateInput = document.getElementById('selectedDate');
const djNameInput = document.getElementById('djName');
const bookedList = document.getElementById('bookedList');
const adminList = document.getElementById('adminList');
const adminActions = document.getElementById('adminActions');

let current = new Date();
let selectedDate = null;
let adminToken = localStorage.getItem('adminToken') || null;
if (adminToken) adminActions.classList.remove('hidden');

function setMessage(msg, isError = false) {
  messageEl.textContent = msg;
  messageEl.style.color = isError ? '#f87171' : '#34d399';
}

async function fetchMonth() {
  setMessage('Loading...');
  const y = current.getFullYear();
  const m = current.getMonth() + 1;
  monthLabel.textContent = `${current.toLocaleString('en-US', { month: 'long' })} ${y}`;

  const res = await fetch(`/api/calendar/${y}/${m}`);
  const data = await res.json();
  renderCalendar(data.calendar);
  await refreshBooked();
  setMessage('');
}

function renderCalendar(days) {
  calendarEl.innerHTML = '';
  days.forEach((d) => {
    const div = document.createElement('div');
    div.className = 'day';
    const statusClass = d.status === 'available' ? 'available' : 'booked';
    div.innerHTML = `<h4>${d.date} (${d.day})</h4>
      <span class="status ${statusClass}">${d.status === 'available' ? 'Available' : 'Booked'}</span>
      ${d.djName ? `<div>${d.djName}</div>` : ''}`;

    if (d.status === 'available') {
      div.classList.add('selectable');
      div.onclick = () => {
        document.querySelectorAll('.day').forEach((x) => x.classList.remove('selected'));
        div.classList.add('selected');
        selectedDate = d.date;
        selectedDateInput.value = selectedDate;
      };
    }
    calendarEl.appendChild(div);
  });
}

async function refreshBooked() {
  const res = await fetch('/api/bookings');
  const data = await res.json();
  bookedList.innerHTML = data.bookings.length
    ? data.bookings.map((b) => `<div>${b.date} - <b>${b.djName}</b> (${b.status})</div>`).join('')
    : '<div class="small">No bookings yet.</div>';

  renderAdminList(data.bookings);
}

function renderAdminList(bookings) {
  if (!adminToken) {
    adminList.innerHTML = '';
    return;
  }

  adminList.innerHTML = bookings.map((b) => `
    <div class="admin-item">
      <span>${b.date}</span>
      <input data-date="${b.date}" value="${b.djName}" />
      <div>
        <button onclick="editBooking('${b.date}')">Edit DJ Name</button>
        <button onclick="deleteBooking('${b.date}')">Delete Booking</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('bookBtn').onclick = async () => {
  if (!selectedDate) return setMessage('Please select an available date first', true);
  const djName = djNameInput.value.trim();
  if (!djName) return setMessage('DJ Name is required', true);

  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: selectedDate, djName })
  });
  const data = await res.json();
  if (!res.ok) return setMessage(data.message || 'Booking failed', true);

  setMessage('Booking confirmed');
  selectedDate = null;
  selectedDateInput.value = '';
  djNameInput.value = '';
  await fetchMonth();
};

document.getElementById('prevMonth').onclick = () => { current.setMonth(current.getMonth() - 1); fetchMonth(); };
document.getElementById('nextMonth').onclick = () => { current.setMonth(current.getMonth() + 1); fetchMonth(); };

document.getElementById('adminLoginBtn').onclick = async () => {
  const password = document.getElementById('adminPass').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) return setMessage(data.message || 'Login failed', true);

  adminToken = data.token;
  localStorage.setItem('adminToken', adminToken);
  adminActions.classList.remove('hidden');
  setMessage('Admin logged in');
  await refreshBooked();
};

window.editBooking = async (date) => {
  const input = document.querySelector(`input[data-date="${date}"]`);
  const djName = input.value.trim();
  const res = await fetch(`/api/bookings/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ djName })
  });
  const data = await res.json();
  if (!res.ok) return setMessage(data.message || 'Update failed', true);
  setMessage('Booking updated');
  await fetchMonth();
};

window.deleteBooking = async (date) => {
  const res = await fetch(`/api/bookings/${date}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const data = await res.json();
  if (!res.ok) return setMessage(data.message || 'Delete failed', true);
  setMessage('Booking deleted');
  await fetchMonth();
};

document.getElementById('exportBtn').onclick = async () => {
  const res = await fetch('/api/export/csv', { headers: { Authorization: `Bearer ${adminToken}` } });
  if (!res.ok) return setMessage('Export failed', true);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bookings.csv';
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('downloadSourceBtn').onclick = async () => {
  const res = await fetch('/api/export/source', { headers: { Authorization: `Bearer ${adminToken}` } });
  if (!res.ok) return setMessage('Source download failed', true);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dj-booking-source.zip';
  a.click();
  URL.revokeObjectURL(url);
};

fetchMonth();
