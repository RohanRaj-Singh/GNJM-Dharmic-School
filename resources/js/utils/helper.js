function formatPKR(amount) {
  const value = Number(amount || 0);

  return `Rs. ${value.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
function formatMonth(month) {
  if (!month) return "-";
  const [year, m] = month.split("-");
  const date = new Date(year, m - 1);
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function generateMonthOptions(year = new Date().getFullYear()) {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(year, i);
    return {
      value: `${year}-${String(i + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
    };
  });
}


export { formatMonth, formatPKR, generateMonthOptions };
