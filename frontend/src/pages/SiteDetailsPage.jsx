import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getSiteById } from "../services/siteService";
import { createTender } from "../services/tenderService";
import { siteTabs } from "../config/siteTabs";

import { getPayments } from "../services/paymentService";
import FinanceSummaryCards from "../components/finance/FinanceSummaryCards";
import FinanceRecordsTable from "../components/finance/FinanceRecordsTable";
import { usePaymentManager } from "../hooks/usePaymentManager";

import {
  getRunningTenders,
  getPassedTenders,
  getDueSoonTenders,
  getTenderValue,
} from "../utils/tenderCalculations";

import SiteSummaryCards from "../components/siteDetails/SiteSummaryCards";
import SiteTenderTable from "../components/siteDetails/SiteTenderTable";

function SiteDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [site, setSite] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("running");
  const [searchTerm, setSearchTerm] = useState("");

  const [payments, setPayments] = useState([]);

  const [tenderForm, setTenderForm] = useState({
    title: "",
    status: "running",
    due_date: "",
    description: "",
    estimated_value: "",
  });

  const fetchSiteDetails = async () => {
    try {
      setLoading(true);
  
      const siteData = await getSiteById(id);
      const paymentData = await getPayments({ site_id: id });
  
      setSite(siteData.site);
      setTenders(siteData.tenders || []);
      setPayments(paymentData || []);
    } catch (error) {
      console.error("Failed to load site details", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteDetails();
  }, [id]);

  const handleTenderFormChange = (event) => {
    const { name, value } = event.target;

    setTenderForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddTender = async (event) => {
    event.preventDefault();

    try {
      await createTender({
        company_id: null,
        site_id: Number(id),
        title: tenderForm.title,
        status: tenderForm.status,
        due_date: tenderForm.due_date || null,
        description: tenderForm.description,
        estimated_value: Number(tenderForm.estimated_value || 0),
      });

      setTenderForm({
        title: "",
        status: "running",
        due_date: "",
        description: "",
        estimated_value: "",
      });

      await fetchSiteDetails();
      setActiveTab(tenderForm.status || "running");
    } catch (error) {
      console.error("Failed to add tender:", error);
      alert(error.response?.data?.message || "Failed to add tender.");
    }
  };

  const runningTenders = getRunningTenders(tenders);
  const passedTenders = getPassedTenders(tenders);
  const dueSoonTenders = getDueSoonTenders(tenders);
  const totalTenderValue = getTenderValue(tenders).toFixed(2);

  const getTendersForTab = () => {
    if (activeTab === "running") return runningTenders;
    if (activeTab === "passed") return passedTenders;
    if (activeTab === "due soon") return dueSoonTenders;

    return tenders;
  };

  const filteredTenders = getTendersForTab().filter((tender) => {
    const search = searchTerm.toLowerCase();

    return (
      tender.title?.toLowerCase().includes(search) ||
      tender.status?.toLowerCase().includes(search) ||
      tender.description?.toLowerCase().includes(search) ||
      tender.due_date?.toLowerCase().includes(search) ||
      String(tender.estimated_value || "").includes(search)
    );
  });

  const {
    filteredPayments,
    summary: paymentSummary,
  } = usePaymentManager({
    payments,
    siteId: id,
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
          <p>
            {site.site_type} | {site.status}
          </p>
          <p>{site.address || "No address added"}</p>
        </div>

        <button type="button" onClick={() => navigate("/sites")}>
          Back to Sites
        </button>
      </div>

      <SiteSummaryCards
        totalTenders={tenders.length}
        runningTenders={runningTenders.length}
        passedTenders={passedTenders.length}
        dueSoonTenders={dueSoonTenders.length}
        totalValue={totalTenderValue}
      />

      <section className="payment-grid">
        <div className="panel">
          <h2>Add Tender to This Site</h2>

          <form className="payment-form" onSubmit={handleAddTender}>
            <input
              name="title"
              placeholder="Tender Title"
              value={tenderForm.title}
              onChange={handleTenderFormChange}
              required
            />

            <select
              name="status"
              value={tenderForm.status}
              onChange={handleTenderFormChange}
              required
            >
              <option value="running">Running</option>
              <option value="passed">Passed</option>
              <option value="due soon">Due Soon</option>
              <option value="pending">Pending</option>
            </select>

            <input
              name="due_date"
              type="date"
              value={tenderForm.due_date}
              onChange={handleTenderFormChange}
            />

            <input
              name="estimated_value"
              type="number"
              placeholder="Estimated Value"
              value={tenderForm.estimated_value}
              onChange={handleTenderFormChange}
            />

            <textarea
              name="description"
              placeholder="Description"
              value={tenderForm.description}
              onChange={handleTenderFormChange}
            />

            <button type="submit">Add Tender</button>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>Site Tenders</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                Open a tender from this site to view documents, materials,
                finance, daily progress and subcontractors.
              </p>
            </div>
          </div>

          <div className="tabs">
            {siteTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "active-tab" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="Search tenders by title, status, value, date or description..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <SiteTenderTable
            tenders={filteredTenders}
            onOpenTender={(tenderId) => navigate(`/tenders/${tenderId}`)}
          />

          <FinanceSummaryCards summary={paymentSummary} />

          <FinanceRecordsTable
            title="Site Finance Records"
            payments={filteredPayments}
          />
        </div>
      </section>
    </section>
  );
}

export default SiteDetailsPage;