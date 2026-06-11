import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSiteById } from "../services/siteService";

function SiteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [site, setSite] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSiteDetails = async () => {
    try {
      setLoading(true);

      const data = await getSiteById(id);

      setSite(data.site);
      setTenders(data.tenders || []);
    } catch (error) {
      console.error("Failed to load site details", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteDetails();
  }, [id]);

  const filteredTenders = tenders.filter((tender) => {
    const search = searchTerm.toLowerCase();

    const matchesTab = activeTab === "all" || tender.status === activeTab;

    const matchesSearch =
      tender.title?.toLowerCase().includes(search) ||
      tender.status?.toLowerCase().includes(search) ||
      tender.description?.toLowerCase().includes(search) ||
      tender.due_date?.toLowerCase().includes(search);

    return matchesTab && matchesSearch;
  });

  if (loading) {
    return <div className="panel">Loading site details...</div>;
  }

  if (!site) {
    return <div className="panel">Site not found.</div>;
  }

  return (
    <section className="tender-details-page">
      <div className="panel tender-header">
        <div>
          <h2>{site.site_name}</h2>
          <p>Type: {site.site_type}</p>
          <p>Status: {site.status}</p>
          <p>Address: {site.address || "N/A"}</p>
        </div>

        <button type="button" onClick={() => navigate("/sites")}>
          Back to Sites
        </button>
      </div>

      <div className="summary-cards">
        <div className="card">
          <p>Total Tenders</p>
          <h2>{tenders.length}</h2>
        </div>

        <div className="card">
          <p>Running</p>
          <h2>{tenders.filter((t) => t.status === "running").length}</h2>
        </div>

        <div className="card">
          <p>Passed</p>
          <h2>{tenders.filter((t) => t.status === "passed").length}</h2>
        </div>

        <div className="card">
          <p>Due Soon</p>
          <h2>{tenders.filter((t) => t.status === "due soon").length}</h2>
        </div>
      </div>

      <div className="panel">
        <h2>Site Tenders</h2>

        <div className="tabs">
          <button
            type="button"
            className={activeTab === "all" ? "active-tab" : ""}
            onClick={() => setActiveTab("all")}
          >
            All
          </button>

          <button
            type="button"
            className={activeTab === "running" ? "active-tab" : ""}
            onClick={() => setActiveTab("running")}
          >
            Running
          </button>

          <button
            type="button"
            className={activeTab === "passed" ? "active-tab" : ""}
            onClick={() => setActiveTab("passed")}
          >
            Passed
          </button>

          <button
            type="button"
            className={activeTab === "due soon" ? "active-tab" : ""}
            onClick={() => setActiveTab("due soon")}
          >
            Due Soon
          </button>
        </div>

        <input
          className="search-input"
          type="text"
          placeholder="Search site tenders by title, status, date or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Description</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredTenders.map((tender) => (
              <tr key={tender.id}>
                <td>{tender.title}</td>
                <td>{tender.status}</td>
                <td>{tender.due_date ? tender.due_date.slice(0, 10) : ""}</td>
                <td>{tender.description}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => navigate(`/tenders/${tender.id}`)}
                  >
                    Open Tender
                  </button>
                </td>
              </tr>
            ))}

            {filteredTenders.length === 0 && (
              <tr>
                <td colSpan="5">No tenders found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SiteDetailsPage;