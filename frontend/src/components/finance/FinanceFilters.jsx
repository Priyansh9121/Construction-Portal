/**
 * File purpose:
 * Filter controls for the finance views.
 *
 * Props:
 * - The current filter values and a change handler
 *
 * Rendered by:
 * - FinanceOverview.jsx, PaymentsPage.jsx
 *
 * Important notes:
 * - Controlled component — holds no filter state of its own.
 */

function FinanceFilters({
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filterScope,
    setFilterScope,
    filterTender,
    setFilterTender,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    tenders = [],
  }) {
    return (
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>Finance Filters</h2>
            <p className="muted-text">
              Search and filter finance records by type, scope, tender and date.
            </p>
          </div>
        </div>
  
        {/*
          Every control here was unlabelled — axe flagged the search input,
          three selects and both date inputs.

          The selects and the search carry `aria-label`: their current value
          ("All Types") and placeholder already describe them on screen, so a
          visible label would only repeat what is there.

          The two dates get REAL visible labels, because this was a usability
          bug as well as an accessibility one — two bare date fields side by
          side gave a sighted user no way to tell which one was the start of
          the range and which was the end.
        */}
        <div className="form-grid">
          <input
            type="search"
            aria-label="Search finance records"
            placeholder="Search tender, name, material, notes, amount..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            aria-label="Filter by record type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>

          <select
            aria-label="Filter by scope"
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
          >
            <option value="all">All Scopes</option>
            <option value="PERSONAL_TENDER">Personal Tender</option>
            <option value="SUBCONTRACTOR_TENDER">Subcontractor Tender</option>
            <option value="OFFICE">Office</option>
          </select>

          <select
            aria-label="Filter by tender"
            value={filterTender}
            onChange={(e) => setFilterTender(e.target.value)}
          >
            <option value="all">All Tenders</option>
            {tenders.map((tender) => (
              <option key={tender.id} value={tender.id}>
                {tender.title || tender.tender_name || `Tender ${tender.id}`}
              </option>
            ))}
          </select>

          <label className="field-label">
            From
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="field-label">
            To
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </section>
    );
  }
  
  export default FinanceFilters;