import { AuditFeedSocket } from './ws.comm.js';
import { ExchangeRateStream } from './sse.comm.js';
import { ApprovalPoller } from './lp.comm.js';
import { HealthChecker } from './sp.comm.js';

const auditFeedSocket = new AuditFeedSocket();
const exchangeRateStream = new ExchangeRateStream();
const approvalPoller = new ApprovalPoller();
const healthChecker = new HealthChecker();

export function initCommunication() {
  console.log('Initializing communication...');
  
  auditFeedSocket.connect(); //ws
  exchangeRateStream.connect(); //sse
  healthChecker.start(); //sp
  
  console.log('Communication initialized');
}

// Cleanup connections
window.addEventListener('beforeunload', () => {
  auditFeedSocket.disconnect();
  exchangeRateStream.disconnect();
  approvalPoller.cancelAll();
  healthChecker.stop();
});
