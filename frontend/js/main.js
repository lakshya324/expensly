import { initCommunication } from "./communication/connect.js";
import { AppState } from "./data/state.js";
import { TicketStore } from "./models/ticket.store.js";
import { setupDB } from "./setup.js";
import { UserSession } from "./storage/session.js";
import { renderUIForRole } from "./ui/left.render.js";

async function initApp() {
  console.log('Initializing Expensly...');
  
  try {
    AppState.currentUser = UserSession.get();
    console.log('Current user:', AppState.currentUser.name, '-', AppState.currentUser.department);

    // idb init
    await setupDB();
    
    // render left side
    renderUIForRole(AppState.currentUser.isAdmin);
    
    // load tickets
    AppState.tickets = await TicketStore.getAllTickets();
    
    //init communication
    initCommunication();
    
    // setup comms callbacks
    setupCommunicationCallbacks();
    
    // 6. Initialize DOM event delegation
    if (AppState.currentUser.role !== 'admin') {
      domManager.initEventDelegation('expense-list');
    }
    
    // 7. Setup form handlers based on role
    setupFormHandlers();
    
    // 8. Load draft if exists (only for non-admin)
    if (!AppState.currentUser.isAdmin) {
      loadDraftExpense();
    }
    
    // 9. Render budget grid (only for non-admin)
    if (!AppState.currentUser.isAdmin) {
      renderBudgetGrid();
    }
    
    // 10. Render available tags
    renderAvailableTags();
    
    // 11. Update offline queue badge
    await updateQueueBadge();
    
    // 12. Setup online/offline handlers
    setupOnlineOfflineHandlers();
    
    // 13. Setup diagnostic button
    setupDiagnosticButton();
    
    console.log('✅ Expensly initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    alert('Failed to initialize application. Please refresh the page.');
  }
}

initApp();
if (AppState.currentUser && AppState.currentUser.role !== "admin") {
  setupTaxReportWorker();
}
