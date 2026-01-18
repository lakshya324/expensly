export const CURRENCY = ["USD", "INR"];
export function getCurrencySymbol(currency) {
  const symbols = {
    USD: "$",
    INR: "₹",
  };
  return symbols[currency] || "$";
}
//TODO: use in future when manager logic is added
export function getCurrencyApprovalThreshold(currency) {
  const thresholds = {
    USD: 100, // if amount > 100 USD, needs managerapproval
    INR: 5000, // if amount > 5000 INR, needs manager approval
  };
  return thresholds[currency] || 100;
}
