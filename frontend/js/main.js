import { initCommunication } from "./communication/connect.js";
import { AppState } from "./data/state.js";
import { TicketStore } from "./models/ticket.store.js";
import { setupData, setupDB } from "./setup.js";
import { UserSession } from "./storage/session.js";
import { ticketDomManager } from "./ui/center/ticket.component.js";
import { updateQueueBadge } from "./ui/header/queueBadge.component.js";
import { renderLeftPanelUI } from "./ui/left/render.js";
import { setupDiagnosticButton } from "./utils/diagnostic.js";
import { setupOnlineOfflineHandlers } from "./utils/sync.js";

async function initApp() {
  console.log("Initializing Expensly...");

  try {
    //TODO: check if new login setup works
    // AppState.currentUser = UserSession.get();
    console.log(
      "Current user:",
      AppState.currentUser.name,
      "-",
      AppState.currentUser.department
    );

    // idb init
    await setupDB();

    // load data
    await setupData();

    // render left side
    await renderLeftPanelUI();

    // load tickets
    AppState.tickets = await TicketStore.getAllTickets();

    //init communication
    initCommunication();

    // setup comms callbacks
    setupCommunicationCallbacks();

    // setup middle expense list
    ticketDomManager.initEventDelegation();

    // setup offline queue badge
    await updateQueueBadge();

    // setup sync
    setupOnlineOfflineHandlers();

    // diagnostic button
    setupDiagnosticButton();

    console.log("Expensly initialized successfully");
  } catch (error) {
    console.error("Failed to initialize app:", error);
    alert("Failed to initialize application. Please refresh the page.");
  }
}

initApp();
if (AppState.currentUser && AppState.currentUser.role !== "admin") {
  setupTaxReportWorker();
}
