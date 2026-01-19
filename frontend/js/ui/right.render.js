export function updateStatusIndicator(type, status) {
  const indicator = document.getElementById(`status-${type}`);
  if (!indicator) return;

  // Remove all status classes
  indicator.classList.remove(
    "connected",
    "error",
    "reconnecting",
    "disconnected",
    "polling",
    "healthy",
    "unhealthy"
    // TODO:add idle, timeout, cancelled
  );

  // Add new status
  indicator.classList.add(status);

  console.log(`INDICATOR> ${type.toLowerCase()}: ${status}`);
}

export function addAuditLogEntry(data) {
  const auditLog = document.getElementById("audit-log");

  const entry = document.createElement("p");
  entry.className = `log-entry ${data.action}`;

  const time = new Date(data.timestamp).toLocaleTimeString();
  entry.textContent = `[${time}] ${data.user} ${data.action} $${data.amount} - ${data.department}`;

  auditLog.insertBefore(entry, auditLog.firstChild);

  // Keep only 50 entries
  while (auditLog.children.length > 50) {
    auditLog.removeChild(auditLog.lastChild);
  }
}

export function renderExchangeRates(rates) {
  //Todo: add user preference currency later
  const container = document.getElementById("exchange-rates");
  container.innerHTML = "";

  Object.entries(rates).forEach(([currency, rate]) => {
    const item = document.createElement("div");
    item.className = "rate-item";
    item.innerHTML = `
      <span class="rate-currency">USD → ${currency}</span>
      <span class="rate-value">${rate}</span>
    `;
    container.appendChild(item);
  });
}
