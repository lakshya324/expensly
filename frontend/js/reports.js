import { TicketStore } from "./models/ticket.store.js";
import { UserStore } from "./models/user.store.js";
import { CURRENCY, formatCurrency } from "./utils/currency.js";
import { escapeHtml } from "./utils/html.js";

// DOM elements
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
// const btnPreview = document.getElementById("btn-preview");
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
let currentPage = 1;
let itemsPerPage = 50;
let activeRange = "last30days";

// Initialize
function init() {
  // Set default dates (last 30 days)
  setDateRange("last30days");
  handlePreview(); // Load initial data

  // Initialize worker
  worker = new Worker("js/utils/worker.js");
  worker.onmessage = handleWorkerMessage;

  // Event listeners
  // btnPreview.addEventListener("click", handlePreview);
  btnGenerate.addEventListener("click", handleGenerate);

  // Date validation listeners
  startDateInput.addEventListener("change", () => {
    validateDates();
    activeRange = "custom";
    document.getElementById("date-range-select").value = "custom";
    handlePreview();
  });
  endDateInput.addEventListener("change", () => {
    validateDates();
    activeRange = "custom";
    document.getElementById("date-range-select").value = "custom";
    handlePreview();
  });

  // Date range select listener
  document
    .getElementById("date-range-select")
    .addEventListener("change", (e) => {
      const range = e.target.value;
      activeRange = range;
      setDateRange(range);
      handlePreview();
    });

  // Pagination listeners
  document.getElementById("items-per-page").addEventListener("change", (e) => {
    itemsPerPage = e.target.value === "all" ? "all" : parseInt(e.target.value);
    currentPage = 1;
    displayExpenses(filteredTickets);
  });

  document.getElementById("btn-first-page").addEventListener("click", () => {
    currentPage = 1;
    displayExpenses(filteredTickets);
  });

  document.getElementById("btn-prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      displayExpenses(filteredTickets);
    }
  });

  document.getElementById("btn-next-page").addEventListener("click", () => {
    const totalPages = getTotalPages();
    if (currentPage < totalPages) {
      currentPage++;
      displayExpenses(filteredTickets);
    }
  });

  document.getElementById("btn-last-page").addEventListener("click", () => {
    currentPage = getTotalPages();
    displayExpenses(filteredTickets);
  });

  document.getElementById("current-page").addEventListener("change", (e) => {
    const page = parseInt(e.target.value);
    const totalPages = getTotalPages();
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
      displayExpenses(filteredTickets);
    } else {
      e.target.value = currentPage;
    }
  });
}

// Set date range based on selection
function setDateRange(range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate, endDate;

  switch (range) {
    case "today":
      startDate = new Date(today);
      endDate = new Date(today);
      break;
    case "yesterday":
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(startDate);
      break;
    case "last7days":
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      break;
    case "last30days":
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
      break;
    case "last90days":
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 89);
      break;
    case "thismonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case "lastmonth":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case "thisyear":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case "custom":
      // Don't change dates for custom selection
      return;
    default:
      return;
  }

  startDateInput.value = startDate.toISOString().split("T")[0];
  endDateInput.value = endDate.toISOString().split("T")[0];
}

// Get total pages
function getTotalPages() {
  if (itemsPerPage === "all") return 1;
  return Math.ceil(filteredTickets.length / itemsPerPage);
}

// Update pagination UI
function updatePaginationUI() {
  const totalPages = getTotalPages();
  const paginationEl = document.getElementById("pagination");

  if (filteredTickets.length === 0 || itemsPerPage === "all") {
    paginationEl.style.display = "none";
    return;
  }

  paginationEl.style.display = "flex";

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, filteredTickets.length);

  document.getElementById("page-start").textContent = start;
  document.getElementById("page-end").textContent = end;
  document.getElementById("total-items").textContent = filteredTickets.length;
  document.getElementById("current-page").value = currentPage;
  document.getElementById("total-pages").textContent = totalPages;

  // Disable/enable buttons
  document.getElementById("btn-first-page").disabled = currentPage === 1;
  document.getElementById("btn-prev-page").disabled = currentPage === 1;
  document.getElementById("btn-next-page").disabled =
    currentPage === totalPages;
  document.getElementById("btn-last-page").disabled =
    currentPage === totalPages;

  document.getElementById("current-page").max = totalPages;
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
  // btnPreview.disabled = true;
  // btnPreview.textContent = "Loading...";
  btnGenerate.disabled = true;
  btnDownload.style.display = "none";
  currentPage = 1; // Reset to first page

  // Show loading state
  emptyState.style.display = "none";
  loadingState.style.display = "block";
  expensesTable.style.display = "none";
  summaryStats.style.display = "none";
  document.getElementById("pagination").style.display = "none";

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
    // btnPreview.disabled = false;
    // btnPreview.textContent = "Preview Expenses";
  }
}

// Filter tickets by date range
function filterTicketsByDateRange(tickets, startDate, endDate) {
  return tickets.filter((ticket) => {
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

  // Calculate pagination
  let paginatedTickets = sortedTickets;
  if (itemsPerPage !== "all") {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    paginatedTickets = sortedTickets.slice(start, end);
  }

  // Fetch user data for all submitters to show name and department
  const userCache = new Map();

  for (const ticket of paginatedTickets) {
    const row = document.createElement("tr");

    const date = ticket.timestamp
      ? new Date(ticket.timestamp).toLocaleDateString()
      : "N/A";
    const amount = formatCurrency(
      ticket.amount || 0,
      ticket.currency || CURRENCY[0],
    );
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
      <td><span class="status-badge status-${status.toLowerCase()}">${escapeHtml(status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))}</span></td>
      <td class="tags">${escapeHtml(tags)}</td>
      <td>${submitterInfo}</td>
    `;

    expensesTbody.appendChild(row);
  }

  // Update pagination UI
  updatePaginationUI();
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
    endDate,
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
    }
    const dateStr = new Date().toISOString().split("T")[0];
    filename += `_${dateStr}`;

    btnDownload.download = `${filename}.csv`;
    btnDownload.style.display = "inline-block";

    console.log("Report generation completed");
  }
}

// Initialize on page load
init();
