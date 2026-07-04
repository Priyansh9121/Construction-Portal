function FinanceFilters({
    searchTerm,
    setSearchTerm,
    selectedTenderId,
    setSelectedTenderId,
    selectedSiteId,
    setSelectedSiteId,
    tenders = [],
    sites = [],
    showTenderFilter = true,
    showSiteFilter = true,
  }) {
    return (
      <div className="payment-form">
        <input
          placeholder="Search finance records..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
  
        {showTenderFilter && (
          <select
            value={selectedTenderId || ""}
            onChange={(e) => setSelectedTenderId(e.target.value)}
          >
            <option value="">All Tenders</option>
            {tenders.map((tender) => (
              <option key={tender.id} value={tender.id}>
                {tender.title}
              </option>
            ))}
          </select>
        )}
  
        {showSiteFilter && (
          <select
            value={selectedSiteId || ""}
            onChange={(e) => setSelectedSiteId(e.target.value)}
          >
            <option value="">All Sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.site_name}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }
  
  export default FinanceFilters;