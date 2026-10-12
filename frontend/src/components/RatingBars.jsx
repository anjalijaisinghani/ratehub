// distribution = [{ rating: 1, count: 0 }, ... { rating: 5, count: 7 }]
export default function RatingBars({ distribution }) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rating-bars">
      {[...distribution].reverse().map((d) => (
        <div className="bar-row" key={d.rating}>
          <span>{d.rating}★</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: total ? `${(d.count / total) * 100}%` : '0%' }} />
          </div>
          <span className="muted">{d.count}</span>
        </div>
      ))}
    </div>
  );
}