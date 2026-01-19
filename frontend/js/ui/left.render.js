export function renderUIForRole(isAdmin = false) {
  const adminPanel = document.getElementById('adminPanel');
  const expensePanel = document.getElementById('expensePanel');
  
  if (isAdmin) {
    // Show admin panel
    adminPanel.style.display = 'block';
    expensePanel.style.display = 'none';
  } else {
    // Show expense submission panel
    adminPanel.style.display = 'none';
    expensePanel.style.display = 'block';
  }
}