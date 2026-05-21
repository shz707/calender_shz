import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// TODO: Replace with your Firebase configuration
const firebaseConfig = {
  // apiKey: "YOUR_API_KEY",
  // authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  // projectId: "YOUR_PROJECT_ID",
  // storageBucket: "YOUR_PROJECT_ID.appspot.com",
  // messagingSenderId: "...",
  // appId: "..."
};

// Initialize Firebase only if config is provided
let db = null;
if (firebaseConfig.projectId) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} else {
    console.warn("Firebase configuration is missing. Comments will not persist.");
}

// Calendar State
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedDateStr = null;

// DOM Elements
const monthYearDisplay = document.getElementById('month-year-display');
const calendarGrid = document.getElementById('calendar-grid');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');

const dialog = document.getElementById('comment-dialog');
const dialogTitle = document.getElementById('dialog-title');
const closeDialogBtn = document.getElementById('close-dialog');
const commentsList = document.getElementById('comments-list');
const commentForm = document.getElementById('comment-form');

// Fallback for light dismiss if closedby is not supported
if (!('closedBy' in HTMLDialogElement.prototype)) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isDialogContent = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (isDialogContent) return;
    dialog.close();
  });
}

closeDialogBtn.addEventListener('click', () => dialog.close());

// Store comments data locally for quick access when rendering the calendar
let commentsData = {}; // Format: { "YYYY-MM-DD": [comment1, comment2] }

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayIndex = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    monthYearDisplay.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Fill in empty slots before the first day
    for (let i = 0; i < startDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDiv);
    }

    // Fill in the actual days
    const today = new Date();
    for (let i = 1; i <= totalDays; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayDiv.dataset.date = dateStr;

        if (currentYear === today.getFullYear() && currentMonth === today.getMonth() && i === today.getDate()) {
            dayDiv.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = i;
        dayDiv.appendChild(dayNumber);

        // Render comment indicator if there are comments for this day
        if (commentsData[dateStr] && commentsData[dateStr].length > 0) {
            const indicator = document.createElement('div');
            indicator.className = 'comment-indicator';
            indicator.textContent = `${commentsData[dateStr].length} comment${commentsData[dateStr].length > 1 ? 's' : ''}`;
            dayDiv.appendChild(indicator);
        }

        dayDiv.addEventListener('click', () => openDayModal(dateStr, `${monthNames[currentMonth]} ${i}, ${currentYear}`));
        calendarGrid.appendChild(dayDiv);
    }
}

// Navigation
prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

// Modal Logic
function openDayModal(dateStr, formattedDate) {
    selectedDateStr = dateStr;
    dialogTitle.textContent = `Comments for ${formattedDate}`;
    renderCommentsList(dateStr);
    dialog.showModal();
}

function renderCommentsList(dateStr) {
    commentsList.innerHTML = '';
    const dayComments = commentsData[dateStr] || [];

    if (dayComments.length === 0) {
        commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first!</p>';
        return;
    }

    // Sort comments by timestamp
    const sortedComments = [...dayComments].sort((a, b) => a.timestamp - b.timestamp);

    sortedComments.forEach(comment => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        
        const dateStr = comment.timestamp ? new Date(comment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        
        item.innerHTML = `
            <div class="comment-meta">
                <span class="comment-author">${escapeHTML(comment.name)}</span>
                <span>${dateStr}</span>
            </div>
            <div class="comment-text">${escapeHTML(comment.text)}</div>
        `;
        commentsList.appendChild(item);
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// Form Submission
commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedDateStr) return;

    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name || !text) return;

    const newComment = {
        date: selectedDateStr,
        name: name,
        text: text,
        timestamp: Date.now()
    };

    if (db) {
        try {
            await addDoc(collection(db, "comments"), newComment);
            // Form is cleared below, list updates via snapshot listener
        } catch (error) {
            console.error("Error adding comment: ", error);
            alert("Error adding comment. See console.");
        }
    } else {
        // Fallback if no Firebase configured (local testing only)
        if (!commentsData[selectedDateStr]) {
            commentsData[selectedDateStr] = [];
        }
        commentsData[selectedDateStr].push(newComment);
        renderCalendar();
        renderCommentsList(selectedDateStr);
    }

    nameInput.value = '';
    textInput.value = '';
});

// Firebase Listener
function setupFirebaseListener() {
    if (!db) return;

    const q = query(collection(db, "comments"), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        // Rebuild local comments cache
        commentsData = {};
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (!commentsData[data.date]) {
                commentsData[data.date] = [];
            }
            commentsData[data.date].push(data);
        });

        // Re-render current view to reflect new data
        renderCalendar();
        if (dialog.open && selectedDateStr) {
            renderCommentsList(selectedDateStr);
        }
    });
}

// Init
renderCalendar();
setupFirebaseListener();
