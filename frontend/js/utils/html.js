/**
 * Escape HTML special characters to prevent XSS
 * example: <script>alert("XSS")</script> to &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;
 */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}