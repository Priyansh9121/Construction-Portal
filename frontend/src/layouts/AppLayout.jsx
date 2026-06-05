import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({
  children,
  activePage,
  setActivePage,
}) {
  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="dashboard">
      <Topbar activePage={activePage} />

        {children}
      </main>
    </div>
  );
}

export default AppLayout;