import { initCommunication } from "./communication/connect.js";
import { AppState } from "./data/state.js";
import { TicketStore } from "./models/ticket.store.js";
import { UserStore } from "./models/user.store.js";
import {
  setupCommunicationCallbacks,
  setupData,
  setupDB,
} from "./setup.js";
import { UserSession } from "./storage/session.js";
import { ticketDomManager } from "./ui/center/ticket.component.js";
import { updateQueueBadge } from "./ui/header/queueBadge.component.js";
import { renderLeftPanelUI } from "./ui/left/render.js";
import { setupDiagnosticButton } from "./utils/diagnostic.js";
import { setupOnlineOfflineHandlers } from "./utils/sync.js";

async function initApp() {
  console.log("Initializing Expensly...");

  try {
    // load State
    AppState.currentUser = UserSession.get();
    AppState.tickets = await TicketStore.getAllTickets();
    AppState.users = await UserStore.getAllUsers();
    console.log("Current user:", AppState.currentUser);

    // idb init
    await setupDB();

    // load data
    await setupData();

    // render left side
    await renderLeftPanelUI();

    //init communication
    initCommunication();

    // setup comms callbacks
    setupCommunicationCallbacks();

    // setup middle expense list
    await ticketDomManager.initEventDelegation();

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
