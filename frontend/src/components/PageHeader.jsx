import ExportButtons from "./export/ExportButtons";

function PageHeader({
  title,
  description,
  rows = [],
  columns = [],
  filename,
  summary,
  children,
}) {
  return (
    <section className="panel page-header-panel">
      <div className="page-header-flex">
        <div className="page-header-left">
          <h1>{title}</h1>

          {description && (
            <p className="muted-text">
              {description}
            </p>
          )}
        </div>

        <div className="page-header-right">
          {children}

          {rows.length > 0 && (
            <ExportButtons
              filename={filename}
              title={title}
              rows={rows}
              columns={columns}
              summary={summary}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default PageHeader;