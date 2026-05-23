import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// TODO: Replace with your Supabase configuration
const SUPABASE_URL = 'https://hhhfkbblxzhyektfrwnr.supabase.co'; // e.g., 'https://xyzcompany.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoaGZrYmJseHpoeWVrdGZyd25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzkyMjAsImV4cCI6MjA5NDk1NTIyMH0.xe65rwNDCf19Wp34SXzKNR7MRND-STbYi8kK2Bwqd7k'; // e.g., 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'


// Initialize Supabase only if config is provided
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    alert("CRITICAL ERROR: Supabase configuration is missing. Please add your SUPABASE_URL and SUPABASE_ANON_KEY to app.js.");
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

// Update Background Image based on month
function updateMonthBackground(monthIndex) {
    const paddedMonth = String(monthIndex + 1).padStart(2, '0');
    const imagePath = `assets/${paddedMonth}.jpg`;
    
    const img = new Image();
    img.onload = function() {
        document.body.style.backgroundImage = `url('${imagePath}')`;
    };
    img.onerror = function() {
        document.body.style.backgroundImage = '';
    };
    img.src = imagePath;
}

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

// Store fetched Supabase data in memory for rendering ONLY
let commentsData = {}; 
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

    updateMonthBackground(currentMonth);

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
            
            // Logic for color: Red > Yellow > Blue > Green/Default
            let hasRed = false;
            let hasYellow = false;
            let hasBlue = false;
            
            commentsData[dateStr].forEach(c => {
                if (c.color === 'red') hasRed = true;
                else if (c.color === 'yellow') hasYellow = true;
                else if (c.color === 'blue') hasBlue = true;
            });

            if (hasRed) {
                indicator.className = 'comment-indicator indicator-red';
            } else if (hasYellow) {
                indicator.className = 'comment-indicator indicator-yellow';
            } else if (hasBlue) {
                indicator.className = 'comment-indicator indicator-blue';
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

    if (!supabase) {
        alert("CRITICAL ERROR: Supabase is not configured. Cannot save comment.");
        return;
    }

    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const colorInput = document.getElementById('comment-color');
    const submitBtn = commentForm.querySelector('button[type="submit"]');
    
    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    const color = colorInput.value;

    if (!name || !text) return;

    // 1. Generate unique ID based on Name, Date, and Timestamp
    const currentTimestamp = Date.now();
    // Using encodeURIComponent to ensure special characters don't break the string ID
    const customId = encodeURIComponent(`${name}_${selectedDateStr}_${currentTimestamp}`);

    const newComment = {
        id: customId,
        date: selectedDateStr,
        name: name,
        text: text,
        color: color,
        timestamp: currentTimestamp
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        let isSaved = false;
        let attempts = 0;
        const maxAttempts = 5;

        // 2 & 3. Try to add and verify in a loop
        while (!isSaved && attempts < maxAttempts) {
            attempts++;
            console.log(`Attempt ${attempts} to save comment...`);
            
            // Try to insert (we ignore errors here because we strictly rely on the verification step)
            await supabase.from('comments').insert([newComment]);

            // Wait a moment for database consistency
            await new Promise(r => setTimeout(r, 1000));

            // Verify if it exists
            const { data, error } = await supabase.from('comments').select('id').eq('id', customId);
            if (!error && data && data.length > 0) {
                isSaved = true;
            }
        }

        if (!isSaved) {
            throw new Error("Failed to verify comment saving after maximum attempts.");
        }

        // 4. Check for duplicates (same date, name, text) and delete extras
        const { data: duplicates } = await supabase.from('comments')
            .select('id')
            .eq('date', selectedDateStr)
            .eq('name', name)
            .eq('text', text)
            .order('timestamp', { ascending: true });

        if (duplicates && duplicates.length > 1) {
            // Keep the first one, delete the rest
            const idsToDelete = duplicates.slice(1).map(d => d.id);
            for (const dupId of idsToDelete) {
                await supabase.from('comments').delete().eq('id', dupId);
            }
            console.log(`Cleaned up ${idsToDelete.length} duplicate(s).`);
        }

        await logHistory('added', `"${name}" added a comment on ${selectedDateStr}`);
        
        // 5. Refresh the page to show the confirmed database state
        window.location.reload();

    } catch (error) {
        console.error("Error adding comment: ", error);
        alert("Database Error (Add Comment): " + (error.message || JSON.stringify(error)));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
});

// Delete Comment
async function deleteComment(comment) {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    if (!supabase) {
        alert("CRITICAL ERROR: Supabase is not configured. Cannot delete comment.");
        return;
    }

    try {
        const { error } = await supabase.from('comments').delete().eq('id', comment.id);
        if (error) throw error;
        await logHistory('deleted', `"${comment.name}"'s comment on ${comment.date} was deleted`);
    } catch (error) {
        console.error("Error deleting comment: ", error);
        alert("Database Error (Delete Comment): " + (error.message || JSON.stringify(error)));
    }
}

// Log History (Supabase)
async function logHistory(action, description) {
    if (!supabase) return;
    try {
        const historyId = encodeURIComponent(`hist_${action}_${Date.now()}_${Math.random()}`);
        const { error } = await supabase.from('history').insert([{
            id: historyId,
            action: action,
            timestamp: Date.now(),
            month: currentMonthYearStr,
            description: description
        }]);
        if (error) throw error;
    } catch (error) {
        console.error("Failed to log history: ", error);
        alert("Database Error (Log History): " + (error.message || JSON.stringify(error)));
    }
}

// Export Data Logic
exportDataBtn.addEventListener('click', () => {
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


// Supabase Listeners & Initialization
async function setupSupabaseListeners() {
    if (!supabase) return;

    // 1. Initial Fetch
    try {
        const { data: initialComments, error: commentsErr } = await supabase.from('comments').select('*');
        if (commentsErr) throw commentsErr;
        
        commentsData = {};
        if (initialComments) {
            initialComments.forEach(data => {
                if (!commentsData[data.date]) commentsData[data.date] = [];
                commentsData[data.date].push(data);
            });
        }
        renderCalendar();
        if (dialog.open && selectedDateStr) renderCommentsList(selectedDateStr);
    } catch (error) {
        alert("Database Error (Fetch Comments): " + (error.message || JSON.stringify(error)));
    }

    try {
        const { data: initialHistory, error: historyErr } = await supabase.from('history').select('*').order('timestamp', { ascending: false });
        if (historyErr) throw historyErr;
        
        if (initialHistory) {
            historyData = initialHistory;
            if (historyDialog.open) renderHistoryList();
        }
    } catch (error) {
        alert("Database Error (Fetch History): " + (error.message || JSON.stringify(error)));
    }

    // 2. Setup Realtime Subscriptions
    supabase.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
          if (payload.eventType === 'INSERT') {
              const data = payload.new;
              if (!commentsData[data.date]) commentsData[data.date] = [];
              if (!commentsData[data.date].find(c => c.id === data.id)) {
                  commentsData[data.date].push(data);
              }
          } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              Object.keys(commentsData).forEach(date => {
                  commentsData[date] = commentsData[date].filter(c => c.id !== deletedId);
              });
          }
          renderCalendar();
          if (dialog.open && selectedDateStr) renderCommentsList(selectedDateStr);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history' }, (payload) => {
          if (payload.eventType === 'INSERT') {
              historyData.push(payload.new);
          }
          if (historyDialog.open) renderHistoryList();
      })
      .subscribe((status, err) => {
          if (err) {
              console.error("Subscription Error:", err);
              // alert("Database Error (Realtime Sync): " + (err.message || JSON.stringify(err)));
          }
      });
}

// Init
renderCalendar();
setupSupabaseListeners();
