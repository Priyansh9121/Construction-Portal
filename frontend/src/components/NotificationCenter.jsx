import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { formatCurrency } from "../utils/currency";

/**
 * Reduces a link to a safe in-app path.
 *
 * Anything that could leave the origin — a scheme, a protocol-relative
 * "//host", or the backslash form that React Router 7.12–8.2 mishandles —
 * falls back to the dashboard rather than navigating away.
 */
function toInternalPath(value) {
  const path = String(value || "").trim();

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\") ||
    path.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    return "/dashboard";
  }

  return path;
}

function NotificationCenter({
  tenders = [],
  invoices = [],
  payments = [],
}) {
  const [open, setOpen] = useState(false);

  const notifications = useMemo(() => {
    const items = [];

    tenders
      .filter((tender) => tender.status === "due soon")
      .slice(0, 5)
      .forEach((tender) => {
        items.push({
          type: "Tender",
          title: `Tender due soon: ${tender.title}`,
          path: `/tenders/${tender.id}`,
        });
      });

    invoices
      .filter((invoice) => invoice.status === "overdue")
      .slice(0, 5)
      .forEach((invoice) => {
        items.push({
          type: "Invoice",
          title: `Overdue invoice: ${invoice.invoice_number}`,
          path: "/invoices",
        });
      });

    const gstTotal = payments
      .filter((p) => p.payment_sub_type === "GOVERNMENT_BILL")
      .reduce((sum, p) => sum + Number(p.gst_amount || 0), 0);

    const gstReturned = payments
      .filter((p) => p.payment_sub_type === "GST_RETURN")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    if (gstTotal - gstReturned > 0) {
      items.push({
        type: "GST",
        title: `GST pending: ${formatCurrency(gstTotal - gstReturned)}`,
        path: "/payments",
      });
    }

    return items;
  }, [tenders, invoices, payments]);

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-button"
        onClick={() => setOpen((prev) => !prev)}
      >
        🔔
        {notifications.length > 0 && (
          <span>{notifications.length}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="notification-panel"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
          >
            <h3>Notifications</h3>

            {notifications.map((item, index) => (
              <Link
                key={`${item.type}-${index}`}
                // Notification links come from the database, so they are
                // the one place in this app where a route target is not a
                // literal. React Router 7.12–8.2 has an open-redirect issue
                // where a backslash-prefixed target escapes the origin, so
                // the value is constrained to an in-app path here rather
                // than trusted as-is.
                to={toInternalPath(item.path)}
                onClick={() => setOpen(false)}
              >
                <strong>{item.type}</strong>
                <span>{item.title}</span>
              </Link>
            ))}

            {notifications.length === 0 && (
              <p>No active alerts.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationCenter;