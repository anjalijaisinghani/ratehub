// Shows a rating as stars, e.g. ★★★★☆ 4.0. Shows "Not rated" if there is no value.
export default function Stars({ value }) {
  if (value === null || value === undefined) {
    return <span className="muted">Not rated</span>;
  }

  const number = Number(value);
  const filled = Math.round(number);

  return (
    <span className="stars">
      {'★'.repeat(filled)}
      {'☆'.repeat(5 - filled)}
      <span className="stars-num">{number.toFixed(1)}</span>
    </span>
  );
}