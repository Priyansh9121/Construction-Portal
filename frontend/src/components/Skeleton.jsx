function Skeleton({ type = "card", rows = 4 }) {
    if (type === "table") {
      return (
        <div className="panel">
          <div className="skeleton skeleton-title" />
  
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="skeleton skeleton-row" />
          ))}
        </div>
      );
    }
  
    return <div className="skeleton skeleton-card" />;
  }
  
export default Skeleton;
