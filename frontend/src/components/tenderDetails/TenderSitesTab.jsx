import {
    useMemo,
    useState,
  } from "react";
  
  function TenderSitesTab({
    sites = [],
    tender,
  }) {
    const [
      searchTerm,
      setSearchTerm,
    ] = useState("");
  
    const [
      statusFilter,
      setStatusFilter,
    ] = useState("all");
  
    const [
      typeFilter,
      setTypeFilter,
    ] = useState("all");
  
    const normaliseStatus = (
      value
    ) =>
      String(value || "")
        .trim()
        .toLowerCase();
  
    const normaliseType = (
      value
    ) =>
      String(value || "")
        .trim()
        .toLowerCase();
  
    const activeSites =
      useMemo(
        () =>
          sites.filter(
            (site) =>
              normaliseStatus(
                site.status
              ) === "active"
          ),
        [sites]
      );
  
    const plannedSites =
      useMemo(
        () =>
          sites.filter(
            (site) =>
              normaliseStatus(
                site.status
              ) === "planned"
          ),
        [sites]
      );
  
    const pausedSites =
      useMemo(
        () =>
          sites.filter(
            (site) =>
              normaliseStatus(
                site.status
              ) === "paused"
          ),
        [sites]
      );
  
    const completedSites =
      useMemo(
        () =>
          sites.filter(
            (site) =>
              normaliseStatus(
                site.status
              ) === "completed"
          ),
        [sites]
      );
  
    const averageProgress =
      useMemo(() => {
        if (
          sites.length === 0
        ) {
          return 0;
        }
  
        const total =
          sites.reduce(
            (sum, site) =>
              sum +
              Number(
                site.progress_percent ||
                  0
              ),
            0
          );
  
        return (
          total /
          sites.length
        );
      }, [sites]);
  
    const highestProgress =
      useMemo(() => {
        if (
          sites.length === 0
        ) {
          return 0;
        }
  
        return Math.max(
          ...sites.map(
            (site) =>
              Number(
                site.progress_percent ||
                  0
              )
          )
        );
      }, [sites]);
  
    const lowestProgress =
      useMemo(() => {
        if (
          sites.length === 0
        ) {
          return 0;
        }
  
        return Math.min(
          ...sites.map(
            (site) =>
              Number(
                site.progress_percent ||
                  0
              )
          )
        );
      }, [sites]);
  
    const siteTypes =
      useMemo(() => {
        return [
          ...new Set(
            sites
              .map(
                (site) =>
                  site.site_type
              )
              .filter(Boolean)
          ),
        ];
      }, [sites]);
  
    const filteredSites =
      useMemo(() => {
        const search =
          searchTerm
            .trim()
            .toLowerCase();
  
        return sites.filter(
          (site) => {
            const status =
              normaliseStatus(
                site.status
              );
  
            const type =
              normaliseType(
                site.site_type
              );
  
            const matchesStatus =
              statusFilter ===
                "all" ||
              status ===
                statusFilter;
  
            const matchesType =
              typeFilter === "all" ||
              type ===
                normaliseType(
                  typeFilter
                );
  
            const searchableText =
              [
                site.site_name,
                site.address,
                site.site_type,
                site.status,
                site.progress_percent,
                site.description,
                site.notes,
                site.manager_name,
              ]
                .filter(
                  (value) =>
                    value !==
                      null &&
                    value !==
                      undefined
                )
                .join(" ")
                .toLowerCase();
  
            const matchesSearch =
              !search ||
              searchableText.includes(
                search
              );
  
            return (
              matchesStatus &&
              matchesType &&
              matchesSearch
            );
          }
        );
      }, [
        sites,
        searchTerm,
        statusFilter,
        typeFilter,
      ]);
  
    const getStatusClass = (
      status
    ) => {
      const value =
        normaliseStatus(
          status
        );
  
      if (
        value === "active" ||
        value === "completed"
      ) {
        return "badge green";
      }
  
      if (
        value === "planned" ||
        value === "paused"
      ) {
        return "badge yellow";
      }
  
      if (
        value === "inactive" ||
        value === "cancelled"
      ) {
        return "badge red";
      }
  
      return "badge blue";
    };
  
    const getProgressValue = (
      value
    ) =>
      Math.min(
        100,
        Math.max(
          0,
          Number(value || 0)
        )
      );
  
    const getProgressLabel = (
      value
    ) =>
      `${getProgressValue(
        value
      ).toFixed(0)}%`;
  
    const resetFilters = () => {
      setSearchTerm("");
      setStatusFilter("all");
      setTypeFilter("all");
    };
  
    return (
      <>
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Project Sites Overview
              </h2>
  
              <p className="muted-text">
                Review every physical site
                attached to{" "}
                {tender?.title ||
                  tender?.tender_name ||
                  "this project"}.
              </p>
            </div>
  
            <span className="badge blue">
              {sites.length} Site
              {sites.length === 1
                ? ""
                : "s"}
            </span>
          </div>
        </section>
  
        <section className="summary-cards">
          <div className="card">
            <p>Total Sites</p>
  
            <h2>
              {sites.length}
            </h2>
          </div>
  
          <div className="card highlight-success">
            <p>Active Sites</p>
  
            <h2>
              {activeSites.length}
            </h2>
          </div>
  
          <div className="card highlight-warning">
            <p>Planned Sites</p>
  
            <h2>
              {plannedSites.length}
            </h2>
          </div>
  
          <div className="card">
            <p>Paused Sites</p>
  
            <h2>
              {pausedSites.length}
            </h2>
          </div>
  
          <div className="card">
            <p>Completed Sites</p>
  
            <h2>
              {completedSites.length}
            </h2>
          </div>
  
          <div className="card">
            <p>
              Average Progress
            </p>
  
            <h2>
              {averageProgress.toFixed(
                1
              )}
              %
            </h2>
          </div>
  
          <div className="card">
            <p>
              Highest Progress
            </p>
  
            <h2>
              {highestProgress.toFixed(
                0
              )}
              %
            </h2>
          </div>
  
          <div className="card">
            <p>
              Lowest Progress
            </p>
  
            <h2>
              {lowestProgress.toFixed(
                0
              )}
              %
            </h2>
          </div>
        </section>
  
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Site Filters
              </h2>
  
              <p className="muted-text">
                Search or filter project
                sites by status and type.
              </p>
            </div>
  
            <button
              type="button"
              className="secondary-btn"
              onClick={
                resetFilters
              }
            >
              Reset Filters
            </button>
          </div>
  
          <div className="form-grid">
            <label>
              Search Sites
  
              <input
                placeholder="Search by name, address, type or status"
                value={
                  searchTerm
                }
                onChange={(
                  event
                ) =>
                  setSearchTerm(
                    event.target
                      .value
                  )
                }
              />
            </label>
  
            <label>
              Status
  
              <select
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All Statuses
                </option>
  
                <option value="active">
                  Active
                </option>
  
                <option value="planned">
                  Planned
                </option>
  
                <option value="paused">
                  Paused
                </option>
  
                <option value="completed">
                  Completed
                </option>
  
                <option value="inactive">
                  Inactive
                </option>
  
                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </label>
  
            <label>
              Site Type
  
              <select
                value={
                  typeFilter
                }
                onChange={(
                  event
                ) =>
                  setTypeFilter(
                    event.target
                      .value
                  )
                }
              >
                <option value="all">
                  All Site Types
                </option>
  
                {siteTypes.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
  
          <p className="form-preview-total">
            Showing{" "}
            {filteredSites.length} of{" "}
            {sites.length} site
            {sites.length === 1
              ? ""
              : "s"}
          </p>
        </section>
  
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Project Sites Register
              </h2>
  
              <p className="muted-text">
                Complete site list with
                address, status and current
                progress.
              </p>
            </div>
          </div>
  
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Address</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Manager</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
  
              <tbody>
                {filteredSites.map(
                  (site) => {
                    const progress =
                      getProgressValue(
                        site.progress_percent
                      );
  
                    return (
                      <tr key={site.id}>
                        <td>
                          <strong>
                            {site.site_name ||
                              `Site ${site.id}`}
                          </strong>
  
                          {site.description && (
                            <p className="muted-text">
                              {site.description}
                            </p>
                          )}
                        </td>
  
                        <td>
                          {site.address ||
                            "-"}
                        </td>
  
                        <td>
                          {site.site_type ||
                            "-"}
                        </td>
  
                        <td>
                          <span
                            className={
                              getStatusClass(
                                site.status
                              )
                            }
                          >
                            {site.status ||
                              "unknown"}
                          </span>
                        </td>
  
                        <td>
                          <div
                            className="report-bar"
                            style={{
                              minWidth:
                                130,
                            }}
                          >
                            <div
                              className="report-bar-fill"
                              style={{
                                width: `${progress}%`,
                              }}
                            />
                          </div>
  
                          <p className="muted-text">
                            {getProgressLabel(
                              progress
                            )}
                          </p>
                        </td>
  
                        <td>
                          {site.manager_name ||
                            site.site_manager ||
                            "-"}
                        </td>
  
                        <td>
                          {site.updated_at
                            ? String(
                                site.updated_at
                              ).slice(
                                0,
                                10
                              )
                            : site.created_at
                              ? String(
                                  site.created_at
                                ).slice(
                                  0,
                                  10
                                )
                              : "-"}
                        </td>
                      </tr>
                    );
                  }
                )}
  
                {filteredSites.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="7"
                      className="empty-table-message"
                    >
                      No project sites match
                      the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
  
        <section className="dashboard-grid two-column-dashboard">
          {filteredSites.map(
            (site) => {
              const progress =
                getProgressValue(
                  site.progress_percent
                );
  
              return (
                <article
                  className="panel"
                  key={`site-card-${site.id}`}
                >
                  <div className="section-title-row">
                    <div>
                      <h2>
                        {site.site_name ||
                          `Site ${site.id}`}
                      </h2>
  
                      <p className="muted-text">
                        {site.address ||
                          "No address provided"}
                      </p>
                    </div>
  
                    <span
                      className={
                        getStatusClass(
                          site.status
                        )
                      }
                    >
                      {site.status ||
                        "unknown"}
                    </span>
                  </div>
  
                  <div className="report-bar">
                    <div
                      className="report-bar-fill"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
  
                  <table>
                    <tbody>
                      <tr>
                        <td>
                          Site Type
                        </td>
  
                        <td className="amount-cell">
                          {site.site_type ||
                            "-"}
                        </td>
                      </tr>
  
                      <tr>
                        <td>
                          Progress
                        </td>
  
                        <td className="amount-cell">
                          {getProgressLabel(
                            progress
                          )}
                        </td>
                      </tr>
  
                      <tr>
                        <td>
                          Manager
                        </td>
  
                        <td className="amount-cell">
                          {site.manager_name ||
                            site.site_manager ||
                            "-"}
                        </td>
                      </tr>
  
                      <tr>
                        <td>
                          Created
                        </td>
  
                        <td className="amount-cell">
                          {site.created_at
                            ? String(
                                site.created_at
                              ).slice(
                                0,
                                10
                              )
                            : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
  
                  {site.notes && (
                    <p
                      className="muted-text"
                      style={{
                        marginTop:
                          "12px",
                      }}
                    >
                      {site.notes}
                    </p>
                  )}
                </article>
              );
            }
          )}
  
          {filteredSites.length ===
            0 && (
            <div className="empty-table-message">
              No site cards to display.
            </div>
          )}
        </section>
      </>
    );
  }
  
  export default TenderSitesTab;