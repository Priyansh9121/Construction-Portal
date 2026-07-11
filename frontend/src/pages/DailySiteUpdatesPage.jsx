import {
  useEffect,
  useMemo,
  useState,
} from "react";

import toast from "react-hot-toast";

import DeleteVerificationModal from "../components/DeleteVerificationModal";
import ExportButtons from "../components/export/ExportButtons";

function DailySiteUpdatesPage({
  sites = [],
  tenders = [],
  workers = [],
  siteLogs = [],
  addSiteLog,
  deleteSiteLog,
}) {
  const [deleteTarget, setDeleteTarget] =
    useState(null);

  const [selectedUpdate, setSelectedUpdate] =
    useState(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [siteFilter, setSiteFilter] =
    useState("all");

  const [workerFilter, setWorkerFilter] =
    useState("all");

  const [photoFilter, setPhotoFilter] =
    useState("all");

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const [cameraPreview, setCameraPreview] =
    useState("");

  const [galleryPreview, setGalleryPreview] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const dateOnly = (value) =>
    value
      ? String(value).slice(0, 10)
      : "-";

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const uniqueSitesReported = useMemo(
    () =>
      new Set(
        siteLogs
          .map(
            (log) =>
              log.site_id ||
              log.site_name
          )
          .filter(Boolean)
      ).size,
    [siteLogs]
  );

  const uniqueWorkersReported = useMemo(
    () =>
      new Set(
        siteLogs
          .map(
            (log) =>
              log.worker_id ||
              log.worker_name
          )
          .filter(Boolean)
      ).size,
    [siteLogs]
  );

  const photoUpdates = useMemo(
    () =>
      siteLogs.filter(
        (log) =>
          Boolean(log.photo_url)
      ),
    [siteLogs]
  );

  const todayUpdates = useMemo(
    () =>
      siteLogs.filter(
        (log) =>
          dateOnly(
            log.log_date ||
              log.created_at
          ) === today
      ),
    [siteLogs, today]
  );

  const latestUpdateDate = useMemo(() => {
    if (!siteLogs.length) {
      return "-";
    }

    const sorted = [...siteLogs].sort(
      (first, second) =>
        new Date(
          second.log_date ||
            second.created_at ||
            0
        ) -
        new Date(
          first.log_date ||
            first.created_at ||
            0
        )
    );

    return dateOnly(
      sorted[0]?.log_date ||
        sorted[0]?.created_at
    );
  }, [siteLogs]);

  const filteredLogs = useMemo(() => {
    const search = searchTerm
      .trim()
      .toLowerCase();

    return [...siteLogs]
      .filter((log) => {
        const logDate = dateOnly(
          log.log_date ||
            log.created_at
        );

        const searchableText = [
          log.site_name,
          log.tender_title,
          log.tender_name,
          log.worker_name,
          log.notes,
          logDate,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !search ||
          searchableText.includes(
            search
          );

        const matchesSite =
          siteFilter === "all" ||
          String(log.site_id) ===
            String(siteFilter);

        const matchesWorker =
          workerFilter === "all" ||
          String(log.worker_id) ===
            String(workerFilter);

        const matchesPhoto =
          photoFilter === "all" ||
          (photoFilter ===
            "with-photo" &&
            Boolean(log.photo_url)) ||
          (photoFilter ===
            "without-photo" &&
            !log.photo_url);

        const matchesFromDate =
          !fromDate ||
          logDate >= fromDate;

        const matchesToDate =
          !toDate ||
          logDate <= toDate;

        return (
          matchesSearch &&
          matchesSite &&
          matchesWorker &&
          matchesPhoto &&
          matchesFromDate &&
          matchesToDate
        );
      })
      .sort(
        (first, second) =>
          new Date(
            second.log_date ||
              second.created_at ||
              0
          ) -
          new Date(
            first.log_date ||
              first.created_at ||
              0
          )
      );
  }, [
    siteLogs,
    searchTerm,
    siteFilter,
    workerFilter,
    photoFilter,
    fromDate,
    toDate,
  ]);

  const filteredPhotoCount = useMemo(
    () =>
      filteredLogs.filter(
        (log) =>
          Boolean(log.photo_url)
      ).length,
    [filteredLogs]
  );

  const dailyUpdateExportColumns = [
    {
      key: "site_name",
      label: "Site",
    },
    {
      key: "tender_title",
      label: "Tender",
    },
    {
      key: "worker_name",
      label: "Worker",
    },
    {
      key: "log_date",
      label: "Date",
    },
    {
      key: "notes",
      label: "Notes",
    },
    {
      key: "photo_status",
      label: "Photo",
    },
    {
      key: "photo_url",
      label: "Photo URL",
    },
  ];

  const dailyUpdateExportRows =
    filteredLogs.map((log) => ({
      site_name:
        log.site_name || "",
      tender_title:
        log.tender_title ||
        log.tender_name ||
        "",
      worker_name:
        log.worker_name || "",
      log_date: dateOnly(
        log.log_date ||
          log.created_at
      ),
      notes:
        log.notes || "",
      photo_status:
        log.photo_url
          ? "Available"
          : "Not available",
      photo_url:
        log.photo_url || "",
    }));

  const dailyUpdateExportSummary = {
    "Total Updates":
      siteLogs.length,
    "Today's Updates":
      todayUpdates.length,
    "Updates With Photos":
      photoUpdates.length,
    "Updates Without Photos":
      siteLogs.length -
      photoUpdates.length,
    "Sites Reported":
      uniqueSitesReported,
    "Workers Reported":
      uniqueWorkersReported,
    "Latest Update":
      latestUpdateDate,
    "Filtered Records":
      filteredLogs.length,
  };

  const revokePreview = (previewUrl) => {
    if (
      previewUrl?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        previewUrl
      );
    }
  };

  const clearPreviews = () => {
    revokePreview(cameraPreview);
    revokePreview(galleryPreview);

    setCameraPreview("");
    setGalleryPreview("");
  };

  useEffect(() => {
    return () => {
      revokePreview(cameraPreview);
      revokePreview(galleryPreview);
    };
  }, [
    cameraPreview,
    galleryPreview,
  ]);

  const handleFilePreview = (
    event,
    preview,
    setPreview
  ) => {
    const file =
      event.target.files?.[0];

    revokePreview(preview);

    if (!file) {
      setPreview("");
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      event.target.value = "";

      setPreview("");

      toast.error(
        "Please select a valid image file."
      );

      return;
    }

    const maxFileSize =
      10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      event.target.value = "";

      setPreview("");

      toast.error(
        "The image must be smaller than 10 MB."
      );

      return;
    }

    setPreview(
      URL.createObjectURL(file)
    );
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (
      typeof addSiteLog !==
      "function"
    ) {
      toast.error(
        "Daily update submission is unavailable."
      );

      return;
    }

    try {
      setSubmitting(true);

      await addSiteLog(event);

      clearPreviews();

      toast.success(
        "Daily site update added successfully."
      );
    } catch (error) {
      console.error(
        "Failed to add daily update:",
        error.response?.data || error
      );

      toast.error(
        error.response?.data?.message ||
          "Failed to add daily site update."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete =
    async () => {
      if (
        !deleteTarget ||
        deleting
      ) {
        return;
      }

      if (
        typeof deleteSiteLog !==
        "function"
      ) {
        toast.error(
          "Delete function is unavailable."
        );

        return;
      }

      try {
        setDeleting(true);

        await deleteSiteLog(
          deleteTarget.id
        );

        if (
          selectedUpdate?.id ===
          deleteTarget.id
        ) {
          setSelectedUpdate(null);
        }

        setDeleteTarget(null);

        toast.success(
          "Daily update deleted successfully."
        );
      } catch (error) {
        console.error(
          "Failed to delete daily update:",
          error.response?.data ||
            error
        );

        toast.error(
          error.response?.data
            ?.message ||
            "Failed to delete daily update."
        );
      } finally {
        setDeleting(false);
      }
    };

  const resetFilters = () => {
    setSearchTerm("");
    setSiteFilter("all");
    setWorkerFilter("all");
    setPhotoFilter("all");
    setFromDate("");
    setToDate("");
  };

  return (
    <>
      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Daily Site Updates
            </h2>

            <p className="muted-text">
              Capture site activity,
              worker progress, notes and
              construction photos.
            </p>
          </div>

          <ExportButtons
            filename="daily-site-updates"
            title="Daily Site Updates Report"
            subtitle="Construction Portal daily progress register"
            rows={
              dailyUpdateExportRows
            }
            columns={
              dailyUpdateExportColumns
            }
            summary={
              dailyUpdateExportSummary
            }
          />
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <p>Total Updates</p>
          <h2>{siteLogs.length}</h2>
        </div>

        <div className="card highlight-success">
          <p>Today's Updates</p>
          <h2>
            {todayUpdates.length}
          </h2>
        </div>

        <div className="card">
          <p>Photo Updates</p>
          <h2>
            {photoUpdates.length}
          </h2>
        </div>

        <div className="card">
          <p>Text-Only Updates</p>
          <h2>
            {siteLogs.length -
              photoUpdates.length}
          </h2>
        </div>

        <div className="card">
          <p>Sites Reported</p>
          <h2>
            {uniqueSitesReported}
          </h2>
        </div>

        <div className="card">
          <p>Workers Reported</p>
          <h2>
            {uniqueWorkersReported}
          </h2>
        </div>

        <div className="card">
          <p>Latest Update</p>
          <h2>
            {latestUpdateDate}
          </h2>
        </div>

        <div className="card">
          <p>Filtered Records</p>
          <h2>
            {filteredLogs.length}
          </h2>
        </div>
      </section>

      <section className="payment-grid">
        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Add Daily Site Update
              </h2>

              <p className="muted-text">
                Record work completed,
                responsible worker and
                visual site evidence.
              </p>
            </div>
          </div>

          <form
            className="payment-form"
            onSubmit={handleSubmit}
          >
            <div className="form-section-title">
              <h3>
                Site and Work Details
              </h3>

              <p className="muted-text">
                Select the relevant site,
                tender, worker and
                reporting date.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Site
                <select
                  name="site_id"
                  required
                  defaultValue=""
                  disabled={
                    submitting
                  }
                >
                  <option value="">
                    Select Site
                  </option>

                  {sites.map(
                    (site) => (
                      <option
                        key={site.id}
                        value={site.id}
                      >
                        {
                          site.site_name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Tender
                <select
                  name="tender_id"
                  defaultValue=""
                  disabled={
                    submitting
                  }
                >
                  <option value="">
                    Select Tender
                  </option>

                  {tenders.map(
                    (tender) => (
                      <option
                        key={tender.id}
                        value={
                          tender.id
                        }
                      >
                        {tender.title ||
                          tender.tender_name ||
                          `Tender ${tender.id}`}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Worker
                <select
                  name="worker_id"
                  required
                  defaultValue=""
                  disabled={
                    submitting
                  }
                >
                  <option value="">
                    Select Worker
                  </option>

                  {workers.map(
                    (worker) => (
                      <option
                        key={worker.id}
                        value={
                          worker.id
                        }
                      >
                        {
                          worker.full_name
                        }

                        {worker.role
                          ? ` — ${worker.role}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Update Date
                <input
                  name="log_date"
                  type="date"
                  defaultValue={
                    today
                  }
                  max={today}
                  required
                  disabled={
                    submitting
                  }
                />
              </label>
            </div>

            <small className="muted-text">
              Normal users can only add
              updates and photos for the
              last three days. Older
              entries require
              administrator permission.
            </small>

            <label>
              Work Completed / Daily
              Notes
              <textarea
                name="notes"
                placeholder="Describe completed work, delays, materials used, safety matters or next actions..."
                disabled={submitting}
              />
            </label>

            <div className="form-section-title">
              <h3>
                Progress Photos
              </h3>

              <p className="muted-text">
                Take a new site photo or
                upload an existing image.
              </p>
            </div>

            <div className="form-grid">
              <label>
                Take Site Photo
                <input
                  name="camera_photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={
                    submitting
                  }
                  onChange={(
                    event
                  ) =>
                    handleFilePreview(
                      event,
                      cameraPreview,
                      setCameraPreview
                    )
                  }
                />
              </label>

              <label>
                Upload Existing Photo
                <input
                  name="gallery_photo"
                  type="file"
                  accept="image/*"
                  disabled={
                    submitting
                  }
                  onChange={(
                    event
                  ) =>
                    handleFilePreview(
                      event,
                      galleryPreview,
                      setGalleryPreview
                    )
                  }
                />
              </label>
            </div>

            {(cameraPreview ||
              galleryPreview) && (
              <div className="dashboard-grid two-column-dashboard">
                {cameraPreview && (
                  <div className="card">
                    <p>
                      Camera Photo Preview
                    </p>

                    <img
                      src={
                        cameraPreview
                      }
                      alt="Camera preview"
                      style={{
                        width: "100%",
                        maxHeight: 240,
                        objectFit:
                          "cover",
                        borderRadius: 12,
                        marginTop: 10,
                      }}
                    />
                  </div>
                )}

                {galleryPreview && (
                  <div className="card">
                    <p>
                      Uploaded Photo
                      Preview
                    </p>

                    <img
                      src={
                        galleryPreview
                      }
                      alt="Gallery preview"
                      style={{
                        width: "100%",
                        maxHeight: 240,
                        objectFit:
                          "cover",
                        borderRadius: 12,
                        marginTop: 10,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting..."
                  : "Add Daily Update"}
              </button>

              {(cameraPreview ||
                galleryPreview) && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={
                    clearPreviews
                  }
                  disabled={
                    submitting
                  }
                >
                  Clear Photo Preview
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Update Filters
              </h2>

              <p className="muted-text">
                Search progress records
                and filter by site,
                worker, photo or date.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={resetFilters}
              disabled={deleting}
            >
              Reset
            </button>
          </div>

          <label>
            Search
            <input
              className="search-input"
              type="search"
              placeholder="Search site, tender, worker, notes or date..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
            />
          </label>

          <div className="form-grid">
            <label>
              Site
              <select
                value={siteFilter}
                onChange={(event) =>
                  setSiteFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Sites
                </option>

                {sites.map((site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.site_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Worker
              <select
                value={workerFilter}
                onChange={(event) =>
                  setWorkerFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Workers
                </option>

                {workers.map(
                  (worker) => (
                    <option
                      key={worker.id}
                      value={
                        worker.id
                      }
                    >
                      {
                        worker.full_name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Photo Status
              <select
                value={photoFilter}
                onChange={(event) =>
                  setPhotoFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Updates
                </option>

                <option value="with-photo">
                  With Photo
                </option>

                <option value="without-photo">
                  Without Photo
                </option>
              </select>
            </label>

            <label>
              From Date
              <input
                type="date"
                value={fromDate}
                onChange={(event) =>
                  setFromDate(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              To Date
              <input
                type="date"
                value={toDate}
                onChange={(event) =>
                  setToDate(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <table>
            <tbody>
              <tr>
                <td>
                  Matching Updates
                </td>

                <td className="number-cell">
                  {
                    filteredLogs.length
                  }
                </td>
              </tr>

              <tr>
                <td>
                  With Photos
                </td>

                <td className="number-cell">
                  {
                    filteredPhotoCount
                  }
                </td>
              </tr>

              <tr>
                <td>
                  Without Photos
                </td>

                <td className="number-cell">
                  {filteredLogs.length -
                    filteredPhotoCount}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {selectedUpdate && (
        <section className="panel">
          <div className="section-title-row">
            <div>
              <h2>
                Daily Update Preview
              </h2>

              <p className="muted-text">
                Detailed progress entry
                and attached construction
                photo.
              </p>
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                setSelectedUpdate(null)
              }
            >
              Close Preview
            </button>
          </div>

          <section className="summary-cards">
            <div className="card">
              <p>Site</p>
              <h2>
                {selectedUpdate.site_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Tender</p>

              <h2>
                {selectedUpdate.tender_title ||
                  selectedUpdate.tender_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Worker</p>

              <h2>
                {selectedUpdate.worker_name ||
                  "-"}
              </h2>
            </div>

            <div className="card">
              <p>Date</p>

              <h2>
                {dateOnly(
                  selectedUpdate.log_date ||
                    selectedUpdate.created_at
                )}
              </h2>
            </div>
          </section>

          <div className="payment-grid">
            <div className="panel">
              <h3>
                Progress Notes
              </h3>

              <p>
                {selectedUpdate.notes ||
                  "No notes provided."}
              </p>
            </div>

            <div className="panel">
              <h3>
                Progress Photo
              </h3>

              {selectedUpdate.photo_url ? (
                <>
                  <img
                    src={
                      selectedUpdate.photo_url
                    }
                    alt="Site progress"
                    style={{
                      width: "100%",
                      maxHeight: 360,
                      objectFit:
                        "cover",
                      borderRadius: 12,
                    }}
                  />

                  <div className="form-actions">
                    <a
                      href={
                        selectedUpdate.photo_url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Full Photo
                    </a>
                  </div>
                </>
              ) : (
                <p className="muted-text">
                  No photo is attached
                  to this update.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-title-row">
          <div>
            <h2>
              Daily Progress Register
            </h2>

            <p className="muted-text">
              {filteredLogs.length}{" "}
              matching update
              {filteredLogs.length === 1
                ? ""
                : "s"}
              .
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Tender</th>
                <th>Worker</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Photo</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredLogs.map(
                (log) => (
                  <tr key={log.id}>
                    <td>
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={() =>
                          setSelectedUpdate(
                            log
                          )
                        }
                      >
                        {log.site_name ||
                          "-"}
                      </button>
                    </td>

                    <td>
                      {log.tender_title ||
                        log.tender_name ||
                        "-"}
                    </td>

                    <td>
                      {log.worker_name ||
                        "-"}
                    </td>

                    <td>
                      {dateOnly(
                        log.log_date ||
                          log.created_at
                      )}
                    </td>

                    <td>
                      {log.notes || "-"}
                    </td>

                    <td>
                      {log.photo_url ? (
                        <a
                          href={
                            log.photo_url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Photo
                        </a>
                      ) : (
                        "No photo"
                      )}
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            setSelectedUpdate(
                              log
                            )
                          }
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() =>
                            setDeleteTarget(
                              log
                            )
                          }
                          disabled={
                            deleting
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}

              {filteredLogs.length ===
                0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="empty-table-message"
                  >
                    No daily updates
                    found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DeleteVerificationModal
        open={Boolean(deleteTarget)}
        itemName={
          deleteTarget?.site_name ||
          deleteTarget?.worker_name ||
          "daily update"
        }
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          handleConfirmDelete
        }
        loading={deleting}
      />
    </>
  );
}

export default DailySiteUpdatesPage;