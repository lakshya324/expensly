import { TicketStore } from "./models/ticket.store.js";
import { UserStore } from "./models/user.store.js";
import { CURRENCY, formatCurrency } from "./utils/currency.js";
import { escapeHtml } from "./utils/html.js";

// DOM elements
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const btnPreview = document.getElementById("btn-preview");
const btnGenerate = document.getElementById("btn-generate");
const btnDownload = document.getElementById("btn-download");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const expensesTable = document.getElementById("expenses-table");
const expensesTbody = document.getElementById("expenses-tbody");
const summaryStats = document.getElementById("summary-stats");
const totalCountEl = document.getElementById("total-count");
// const totalAmountEl = document.getElementById("total-amount");
const dateRangeEl = document.getElementById("date-range");

let filteredTickets = [];
let worker = null;

// Initialize
function init() {
  // Set default dates (e.g., current month)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  startDateInput.value = firstDay.toISOString().split('T')[0];
  endDateInput.value = lastDay.toISOString().split('T')[0];

  // Initialize worker
  worker = new Worker("js/utils/worker.js");
  worker.onmessage = handleWorkerMessage;

  // Event listeners
  btnPreview.addEventListener("click", handlePreview);
  btnGenerate.addEventListener("click", handleGenerate);
  
  // Date validation listeners
  startDateInput.addEventListener("change", () => {
    validateDates();
    handlePreview();
  });
  endDateInput.addEventListener("change", () => {
    validateDates();
    handlePreview();
  });
}

// Validate date inputs
function validateDates() {
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  // If start date is set, end date must be after or equal to start date
  if (startDate) {
    endDateInput.min = startDate;
  } else {
    endDateInput.removeAttribute("min");
  }

  // If end date is set, start date must be before or equal to end date
  if (endDate) {
    startDateInput.max = endDate;
  } else {
    startDateInput.removeAttribute("max");
  }

  // Show validation message if dates are invalid
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    alert("Start date must be before or equal to end date");
    endDateInput.value = "";
  }
}

// Handle preview button click
async function handlePreview() {
  btnPreview.disabled = true;
  btnPreview.textContent = "Loading...";
  btnGenerate.disabled = true;
  btnDownload.style.display = "none";

  // Show loading state
  emptyState.style.display = "none";
  loadingState.style.display = "block";
  expensesTable.style.display = "none";
  summaryStats.style.display = "none";

  try {
    // Fetch all tickets
    const allTickets = await TicketStore.getAllTickets();
    
    // Filter by date range
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    filteredTickets = filterTicketsByDateRange(allTickets, startDate, endDate);

    // Display results
    if (filteredTickets.length === 0) {
      emptyState.innerHTML = `
        <div class="empty-state-icon">🔍</div>
        <p>No expenses found for the selected date range</p>
        <p style="font-size: 14px; color: #999;">Try adjusting your date filters</p>
      `;
      emptyState.style.display = "block";
      loadingState.style.display = "none";
    } else {
      displayExpenses(filteredTickets);
      updateSummaryStats(filteredTickets, startDate, endDate);
      loadingState.style.display = "none";
      expensesTable.style.display = "table";
      summaryStats.style.display = "flex";
      btnGenerate.disabled = false;
    }
  } catch (error) {
    console.error("Error loading expenses:", error);
    emptyState.innerHTML = `
      <div class="empty-state-icon">❌</div>
      <p>Error loading expenses</p>
      <p style="font-size: 14px; color: #999;">${error.message}</p>
    `;
    emptyState.style.display = "block";
    loadingState.style.display = "none";
  } finally {
    btnPreview.disabled = false;
    btnPreview.textContent = "Preview Expenses";
  }
}

// Filter tickets by date range
function filterTicketsByDateRange(tickets, startDate, endDate) {
  return tickets.filter(ticket => {
    if (!ticket.timestamp) return true; // Include tickets without timestamp
    
    const ticketDate = new Date(ticket.timestamp);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Set end date to end of day (23:59:59)
    if (end) {
      end.setHours(23, 59, 59, 999);
    }
    
    // Set start date to beginning of day (00:00:00)
    if (start) {
      start.setHours(0, 0, 0, 0);
    }
    
    if (start && end) {
      return ticketDate >= start && ticketDate <= end;
    } else if (start) {
      return ticketDate >= start;
    } else if (end) {
      return ticketDate <= end;
    }
    
    return true;
  });
}

// Display expenses in table
async function displayExpenses(tickets) {
  expensesTbody.innerHTML = "";
  
  // Sort by date (newest first)
  const sortedTickets = [...tickets].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Fetch user data for all submitters to show name and department
  const userCache = new Map();
  
  for (const ticket of sortedTickets) {
    const row = document.createElement("tr");
    
    const date = ticket.timestamp ? new Date(ticket.timestamp).toLocaleDateString() : "N/A";
    const amount = formatCurrency(ticket.amount || 0, ticket.currency || CURRENCY[0]);
    const status = ticket.status || "pending";
    const tags = (ticket.tags || []).join(", ") || "-";
    
    // Get submitter info with department
    let submitterInfo = "-";
    if (ticket.submittedBy) {
      if (!userCache.has(ticket.submittedBy)) {
        const user = await UserStore.getUserById(ticket.submittedBy);
        userCache.set(ticket.submittedBy, user);
      }
      const user = userCache.get(ticket.submittedBy);
      if (user) {
        submitterInfo = `${escapeHtml(user.name)} <span style="color: #00adb5; font-size: 16px; text-transform: uppercase; font-weight: 600;">(${escapeHtml(user.department)})</span>`;
      } else {
        submitterInfo = escapeHtml(ticket.submittedBy);
      }
    }
    
    row.innerHTML = `
      <td>${date}</td>
      <td>${escapeHtml(ticket.title || "Untitled")}</td>
      <td class="amount">${escapeHtml(amount)}</td>
      <td>${escapeHtml((ticket.department || "-").toUpperCase())}</td>
      <td><span class="status-badge status-${status.toLowerCase()}">${escapeHtml(status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))}</span></td>
      <td class="tags">${escapeHtml(tags)}</td>
      <td>${submitterInfo}</td>
    `;
    
    expensesTbody.appendChild(row);
  }
}

// Update summary statistics
function updateSummaryStats(tickets, startDate, endDate) {
  // Total count
  totalCountEl.textContent = tickets.length;

  // Date range
  if (startDate && endDate) {
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    dateRangeEl.textContent = `${start} - ${end}`;
  } else if (startDate) {
    dateRangeEl.textContent = `From ${new Date(startDate).toLocaleDateString()}`;
  } else if (endDate) {
    dateRangeEl.textContent = `Until ${new Date(endDate).toLocaleDateString()}`;
  } else {
    dateRangeEl.textContent = "All Time";
  }
}

// Handle generate report button click
function handleGenerate() {
  if (filteredTickets.length === 0) return;

  btnGenerate.disabled = true;
  btnGenerate.textContent = "Generating...";
  
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  // Send to worker
  worker.postMessage({
    type: "run",
    tickets: filteredTickets,
    startDate,
    endDate
  });
}

// Handle worker message
function handleWorkerMessage(e) {
  if (e.data.type === "done") {
    btnGenerate.textContent = "Generate CSV Report";
    btnGenerate.disabled = false;

    const reportData = e.data.payload;
    const blob = new Blob([reportData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    btnDownload.href = url;
    
    // Generate filename with date range
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    let filename = "EXPENSLY_expenses_export";
    if (startDate && endDate) {
      filename += `_${startDate}_to_${endDate}`;
    } else if (startDate) {
      filename += `_from_${startDate}`;
    } else if (endDate) {
      filename += `_until_${endDate}`;
    } else {
      const dateStr = new Date().toISOString().split("T")[0];
      filename += `_${dateStr}`;
    }
    btnDownload.download = `${filename}.csv`;
    btnDownload.style.display = "inline-block";

    console.log("Report generation completed");
  }
}

// Initialize on page load
init();
