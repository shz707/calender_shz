import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
let currentMonthYearStr = null;

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

const historyDialog = document.getElementById('history-dialog');
const historyTitle = document.getElementById('history-title');
const closeHistoryBtn = document.getElementById('close-history');
const historyList = document.getElementById('history-list');
const viewHistoryBtn = document.getElementById('view-history-btn');

const themeSelector = document.getElementById('theme-selector');
const exportDataBtn = document.getElementById('export-data-btn');

// Theme Management
const savedTheme = localStorage.getItem('calendar-theme') || 'theme-light-green';
document.body.className = savedTheme;
themeSelector.value = savedTheme;

themeSelector.addEventListener('change', (e) => {
    document.body.className = e.target.value;
    localStorage.setItem('calendar-theme', e.target.value);
});

// Fallback for light dismiss if closedby is not supported
if (!('closedBy' in HTMLDialogElement.prototype)) {
  const handleLightDismiss = (dialogEl) => {
    dialogEl.addEventListener('click', (event) => {
      if (event.target !== dialogEl) return;
      const rect = dialogEl.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (isDialogContent) return;
      dialogEl.close();
    });
  };
  handleLightDismiss(dialog);
  handleLightDismiss(historyDialog);
}

closeDialogBtn.addEventListener('click', () => dialog.close());
closeHistoryBtn.addEventListener('click', () => historyDialog.close());

// Store comments data locally
let commentsData = {}; // Format: { "YYYY-MM-DD": [{id, name, text, color, timestamp}] }
// Store history locally
let historyData = [];

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayIndex = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    
    currentMonthYearStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
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
            
            // Logic for color: Red > Yellow > Green/Default
            let hasRed = false;
            let hasYellow = false;
            
            commentsData[dateStr].forEach(c => {
                if (c.color === 'red') hasRed = true;
                else if (c.color === 'yellow') hasYellow = true;
            });

            if (hasRed) {
                indicator.className = 'comment-indicator indicator-red';
            } else if (hasYellow) {
                indicator.className = 'comment-indicator indicator-yellow';
            } else {
                indicator.className = 'comment-indicator indicator-green';
            }

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

    const sortedComments = [...dayComments].sort((a, b) => a.timestamp - b.timestamp);

    sortedComments.forEach(comment => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        if (comment.color && comment.color !== 'none') {
            item.classList.add(`color-${comment.color}`);
        }
        
        const timeStr = comment.timestamp ? new Date(comment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
        
        item.innerHTML = `
            <div class="comment-meta">
                <span class="comment-author">${escapeHTML(comment.name)}</span>
                <span>${timeStr}</span>
            </div>
            <div class="comment-text">${escapeHTML(comment.text)}</div>
            <button class="delete-btn" aria-label="Delete comment" data-id="${comment.id}">🗑️</button>
        `;

        // Add delete listener
        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // prevent triggering other clicks
            await deleteComment(comment);
        });

        commentsList.appendChild(item);
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// History Modal
viewHistoryBtn.addEventListener('click', () => {
    historyTitle.textContent = `History for ${monthYearDisplay.textContent}`;
    renderHistoryList();
    historyDialog.showModal();
});

function renderHistoryList() {
    historyList.innerHTML = '';
    
    // Filter history for current month
    const currentMonthHistory = historyData.filter(h => h.month === currentMonthYearStr);
    
    if (currentMonthHistory.length === 0) {
        historyList.innerHTML = '<p class="no-comments">No activity this month.</p>';
        return;
    }

    // Sort descending (newest first)
    currentMonthHistory.sort((a, b) => b.timestamp - a.timestamp);

    currentMonthHistory.forEach(log => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const dateStr = new Date(log.timestamp).toLocaleString();
        
        item.innerHTML = `
            <span class="history-time">${dateStr}</span>
            <span class="history-text">${escapeHTML(log.description)}</span>
        `;
        historyList.appendChild(item);
    });
}

// Add Comment
commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedDateStr) return;

    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const colorInput = document.getElementById('comment-color');
    
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    const color = colorInput.value;

    if (!name || !text) return;

    const newComment = {
        date: selectedDateStr,
        name: name,
        text: text,
        color: color,
        timestamp: Date.now()
    };

    if (db) {
        try {
            const docRef = await addDoc(collection(db, "comments"), newComment);
            // Log history
            await logHistory('added', `"${name}" added a comment on ${selectedDateStr}`);
        } catch (error) {
            console.error("Error adding comment: ", error);
            alert("Error adding comment.");
        }
    } else {
        // Local Fallback
        newComment.id = 'local_' + Date.now();
        if (!commentsData[selectedDateStr]) commentsData[selectedDateStr] = [];
        commentsData[selectedDateStr].push(newComment);
        
        historyData.push({
            id: 'hist_' + Date.now(),
            action: 'added',
            timestamp: Date.now(),
            month: selectedDateStr.substring(0, 7),
            description: `"${name}" added a comment on ${selectedDateStr}`
        });

        renderCalendar();
        renderCommentsList(selectedDateStr);
    }

    nameInput.value = '';
    textInput.value = '';
    colorInput.value = 'none';
});

// Delete Comment
async function deleteComment(comment) {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    if (db) {
        try {
            await deleteDoc(doc(db, "comments", comment.id));
            await logHistory('deleted', `"${comment.name}"'s comment on ${comment.date} was deleted`);
        } catch (error) {
            console.error("Error deleting comment: ", error);
            alert("Error deleting comment.");
        }
    } else {
        // Local Fallback
        commentsData[comment.date] = commentsData[comment.date].filter(c => c.id !== comment.id);
        
        historyData.push({
            id: 'hist_' + Date.now(),
            action: 'deleted',
            timestamp: Date.now(),
            month: comment.date.substring(0, 7),
            description: `"${comment.name}"'s comment on ${comment.date} was deleted`
        });

        renderCalendar();
        renderCommentsList(selectedDateStr);
    }
}

// Log History (Firestore)
async function logHistory(action, description) {
    if (!db) return;
    try {
        await addDoc(collection(db, "history"), {
            action: action,
            timestamp: Date.now(),
            month: currentMonthYearStr,
            description: description
        });
    } catch (e) {
        console.error("Failed to log history: ", e);
    }
}

// Export Data Logic
exportDataBtn.addEventListener('click', () => {
    // Collect comments for the current month
    let exportText = `=== Shared Calendar Data Export ===\nMonth: ${monthYearDisplay.textContent}\n\n`;
    
    exportText += `--- COMMENTS ---\n`;
    let hasComments = false;
    Object.keys(commentsData).forEach(date => {
        if (date.startsWith(currentMonthYearStr)) {
            commentsData[date].forEach(c => {
                hasComments = true;
                exportText += `[${date}] ${c.name} (${c.color}): ${c.text}\n`;
            });
        }
    });
    if (!hasComments) exportText += `No comments this month.\n`;

    exportText += `\n--- HISTORY ---\n`;
    const currentMonthHistory = historyData.filter(h => h.month === currentMonthYearStr);
    currentMonthHistory.sort((a, b) => b.timestamp - a.timestamp);
    
    if (currentMonthHistory.length === 0) {
        exportText += `No history logs this month.\n`;
    } else {
        currentMonthHistory.forEach(h => {
            const dateStr = new Date(h.timestamp).toLocaleString();
            exportText += `[${dateStr}] ${h.action.toUpperCase()}: ${h.description}\n`;
        });
    }

    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_${currentMonthYearStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});


// Firebase Listeners
function setupFirebaseListeners() {
    if (!db) return;

    // Comments Listener
    const qComments = query(collection(db, "comments"), orderBy("timestamp", "asc"));
    onSnapshot(qComments, (snapshot) => {
        commentsData = {};
        snapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id; // Store firestore document ID
            if (!commentsData[data.date]) {
                commentsData[data.date] = [];
            }
            commentsData[data.date].push(data);
        });

        renderCalendar();
        if (dialog.open && selectedDateStr) {
            renderCommentsList(selectedDateStr);
        }
    });

    // History Listener
    const qHistory = query(collection(db, "history"), orderBy("timestamp", "desc"));
    onSnapshot(qHistory, (snapshot) => {
        historyData = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id;
            historyData.push(data);
        });

        if (historyDialog.open) {
            renderHistoryList();
        }
    });
}

// Init
renderCalendar();
setupFirebaseListeners();
