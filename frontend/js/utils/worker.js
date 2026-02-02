self.onmessage = async (e) => {
  if (e.data.type !== "run") return;

  // adding a 10 second delay to simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 10000));

  const tickets = e.data.tickets;
  const result = processExpenseData(tickets);

  self.postMessage({
    type: "done",
    payload: result,
  });
};

function processExpenseData(tickets) {
  // Transform tickets into a structured export format
  const exportData = {
    exportDate: new Date().toISOString(),
    totalExpenses: tickets.length,
    totalAmount: calculateTotalAmount(tickets),
    expenses: tickets.map(ticket => ({
      id: ticket.id,
      title: ticket.title,
      amount: ticket.amount,
      currency: ticket.currency,
      department: ticket.department,
      description: ticket.description,
      tags: ticket.tags || [],
      date: ticket.date,
      status: ticket.status,
      flagged: ticket.flagged || false,
      submittedBy: ticket.userId,
      organizationId: ticket.organizationId,
      managerApproval: ticket.manager_approved ? {
        approved: ticket.manager_approved.approved,
        reviewerId: ticket.manager_approved.reviewerId,
        timestamp: ticket.manager_approved.timestamp,
        comments: ticket.manager_approved.comments || null
      } : null,
      financeApproval: ticket.finance_approved ? {
        approved: ticket.finance_approved.approved,
        reviewerId: ticket.finance_approved.reviewerId,
        timestamp: ticket.finance_approved.timestamp,
        comments: ticket.finance_approved.comments || null
      } : null
    }))
  };

  // Return stringified JSON
  return JSON.stringify(exportData, null, 2);
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
