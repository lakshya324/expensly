import { TicketStore } from "../models/ticket.store";

self.onmessage = async (e) => {
  if (e.data.type !== "run") return;

  const tickets = await TicketStore.getAllTickets();
  const result = processWorkerTicket(tickets);

  self.postMessage({
    type: "done",
    payload: result,
  });
};

function processWorkerTicket(ticket) {
  // dummy time-consuming task
    let sum = 0;
    for (let i = 0; i < 1e7; i++) {
      sum += i;
    }
    console.log("Worker processed sum:", sum);
  return ticket;
}
