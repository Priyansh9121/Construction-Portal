import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

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
        title: `GST pending: $${Number(gstTotal - gstReturned).toFixed(2)}`,
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
                to={item.path}
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