/**
 * File purpose:
 * The tab definitions for the tender detail page: order, labels and which
 * component each renders.
 *
 * Connected to:
 * - TenderDetailsPage.jsx
 *
 * Important notes:
 * - Declaring the tabs here keeps the page component from hard-coding nine
 *   branches. The tabs map almost one-to-one onto the tender child
 *   collections in backend/modules/tenders/tender.routes.js.
 */

export const tenderDetailsTabs = [
  {
    key: "overview",
    label: "Overview",
  },
  {
    key: "sites",
    label: "Sites",
  },
  {
    key: "finance",
    label: "Finance",
  },
  {
    key: "workers",
    label: "Workers",
  },
  {
    key: "subcontractors",
    label: "Subcontractors",
  },
  {
    key: "materials",
    label: "Materials",
  },
  {
    key: "documents",
    label: "Documents",
  },
  {
    key: "banking",
    label: "Banking",
  },
  {
    key: "daily",
    label: "Daily Progress",
  },
];