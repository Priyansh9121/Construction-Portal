import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const commands = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Finance / Payments", path: "/payments" },
  { name: "Invoices", path: "/invoices" },
  { name: "Workers", path: "/workers" },
  { name: "Worker Money", path: "/worker-money" },
  { name: "Subcontractors", path: "/subcontractors" },
  { name: "Sites / Projects", path: "/sites" },
  { name: "Tenders", path: "/tenders" },
  { name: "Daily Site Updates", path: "/daily-site-updates" },
  { name: "Update Approvals", path: "/daily-update-approvals" },
  { name: "Reports", path: "/reports" },
  { name: "Settings", path: "/settings" },
];

function CommandPalette() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const listener = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", listener);

    return () => window.removeEventListener("keydown", listener);
  }, []);

  const filteredCommands = useMemo(() => {
    return commands.filter((command) =>
      command.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const goToPage = (path) => {
    navigate(path);
    setSearch("");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="command-modal"
            initial={{ opacity: 0, y: 35, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.94 }}
            transition={{
              duration: 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="command-header">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pages..."
              />

              <span>ESC</span>
            </div>

            <div className="command-results">
              {filteredCommands.map((command) => (
                <button
                  key={command.path}
                  type="button"
                  onClick={() => goToPage(command.path)}
                >
                  <span>{command.name}</span>
                  <small>{command.path}</small>
                </button>
              ))}

              {filteredCommands.length === 0 && (
                <div className="command-empty">No matching page found.</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;