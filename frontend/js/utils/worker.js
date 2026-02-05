self.onmessage = async (e) => {
  if (e.data.type !== "run") return;

  // adding a 10 second delay to simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const tickets = e.data.tickets;
  // const startDate = e.data.startDate;
  // const endDate = e.data.endDate;
  
  const result = processExpenseData(tickets);

  self.postMessage({
    type: "done",
    payload: result,
  });
};

function processExpenseData(tickets) {
  // CSV Headers
  const headers = [
    // 'ID',
    'Title',
    'Amount',
    'Currency',
    'Department',
    'Description',
    'Tags',
    'Date',
    'Status',
    'Flagged',
    // 'Submitted By',
    // 'Organization ID',
    'Manager Approved',
    // 'Manager Reviewer ID',
    'Manager Approval Date',
    'Manager Comments',
    'Finance Approved',
    // 'Finance Reviewer ID',
    'Finance Approval Date',
    'Finance Comments'
  ];

  // Convert tickets to CSV rows
  const rows = tickets.map(ticket => [
    // escapeCSV(ticket.id),
    escapeCSV(ticket.title),
    ticket.amount || 0,
    escapeCSV(ticket.currency || 'USD'),
    escapeCSV(ticket.department),
    escapeCSV(ticket.description),
    escapeCSV((ticket.tags || []).join('; ')),
    escapeCSV(ticket.timestamp),
    escapeCSV(ticket.status),
    ticket.flagged || false,
    // escapeCSV(ticket.submittedBy),
    // escapeCSV(ticket.orgId),
    ticket.managerApproval ? ticket.managerApproval.approved : '',
    // ticket.managerApproval ? escapeCSV(ticket.managerApproval.reviewedBy) : '',
    ticket.managerApproval ? escapeCSV(ticket.managerApproval.reviewedAt) : '',
    ticket.managerApproval ? escapeCSV(ticket.managerApproval.comments || '') : '',
    ticket.financeApproval ? ticket.financeApproval.approved : '',
    // ticket.financeApproval ? escapeCSV(ticket.financeApproval.reviewedBy) : '',
    ticket.financeApproval ? escapeCSV(ticket.financeApproval.reviewedAt) : '',
    ticket.financeApproval ? escapeCSV(ticket.financeApproval.comments || '') : ''
  ]);

  // Combine headers and rows
  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');

  return csv;
}

function escapeCSV(value) {
  if (value == null) return '';
  const stringValue = String(value);
  // If the value contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

function calculateTotalAmount(tickets) {
  // Group amounts by currency
  const totals = {};
  
  tickets.forEach(ticket => {
    const currency = ticket.currency || 'USD';
    if (!totals[currency]) {
      totals[currency] = 0;
    }
    totals[currency] += ticket.amount || 0;
  });
  
  return totals;
}
