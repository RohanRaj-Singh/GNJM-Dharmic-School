import { formatPKR } from "../utils";
import { formatPKR as f } from "../utils";
import { useState } from "react";

/*
 * Fee summary for one division.
 * Handles three states:
 *  - student not enrolled in this division
 *  - student is `free` → suppress monthly pending, show only custom
 *  - normal paid student → full breakdown
 */
export default function FeeSection({ title, fees, enrolled = true, isFree = false, studentType = "paid" }) {
  const [showAll, setShowAll] = useState(false);

  if (!enrolled) {
    return (
      <Wrapper title={`${title} Fees`}>
        <div className="text-sm text-gray-400">
          Student is not enrolled in {title}. No fees to show.
        </div>
      </Wrapper>
    );
  }

  if (isFree) {
    const customRows = fees.rows.filter((r) => r.type === "custom");
    return (
      <Wrapper title={`${title} Fees`}>
        <div className="text-sm text-blue-700 mb-3">
          This student is exempt from monthly fees. Only custom fees are listed below.
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Total Charged"  value={formatPKR(fees.total_charged)} />
          <Stat label="Total Paid"     value={formatPKR(fees.total_paid)}     tone="green" />
          <Stat label="Pending"        value={formatPKR(fees.pending)}        tone="red" />
          <Stat label="Custom Fees"    value={String(customRows.length)} />
        </div>
        {customRows.length > 0 && <CustomFeesList rows={customRows} />}
        {customRows.length === 0 && (
          <div className="text-sm text-gray-400">No custom fees assigned.</div>
        )}
      </Wrapper>
    );
  }

  const visibleRows = showAll ? fees.rows : fees.rows.slice(0, 12);
  const totalRows = fees.rows.length;

  return (
    <Wrapper title={`${title} Fees`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Total Charged" value={formatPKR(fees.total_charged)} />
        <Stat label="Total Paid"    value={formatPKR(fees.total_paid)}    tone="green" />
        <Stat
          label="Pending"
          value={formatPKR(fees.pending)}
          tone={fees.pending > 0 ? "red" : "green"}
        />
        <Stat
          label="Outstanding Months"
          value={String(fees.outstanding_months)}
          tone={fees.outstanding_months > 0 ? "amber" : null}
        />
      </div>

      {fees.last_payment_date && (
        <p className="text-xs text-gray-500 mb-3">
          Last payment: <span className="font-medium text-gray-700">{fees.last_payment_date}</span>
        </p>
      )}

      {/* Monthly breakdown table — always shown when there is data */}
      {fees.monthly_breakdown.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Monthly Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-1.5">Month</th>
                  <th className="text-right px-3 py-1.5">Charged</th>
                  <th className="text-right px-3 py-1.5">Paid</th>
                  <th className="text-right px-3 py-1.5">Pending</th>
                  <th className="text-center px-3 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.monthly_breakdown.map((m) => (
                  <tr key={m.month} className="border-t">
                    <td className="px-3 py-1.5">{m.month}</td>
                    <td className="px-3 py-1.5 text-right">{formatPKR(m.charged)}</td>
                    <td className="px-3 py-1.5 text-right text-green-700">{formatPKR(m.paid)}</td>
                    <td className={`px-3 py-1.5 text-right ${m.pending > 0 ? "text-red-700" : "text-gray-400"}`}>
                      {formatPKR(m.pending)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {m.is_paid ? (
                        <span className="text-green-700 text-xs font-medium">PAID</span>
                      ) : (
                        <span className="text-red-700 text-xs font-medium">DUE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail rows (capped at 12 unless showAll) */}
      {totalRows > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            Fee Details {totalRows > 12 && !showAll && `(showing 12 of ${totalRows})`}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-1.5">Title</th>
                  <th className="text-left px-3 py-1.5">Month</th>
                  <th className="text-right px-3 py-1.5">Amount</th>
                  <th className="text-center px-3 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-1.5">
                      {r.type === "monthly" ? "Monthly Fee" : r.title || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">{r.month || "—"}</td>
                    <td className="px-3 py-1.5 text-right">{formatPKR(r.amount)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {r.is_paid ? (
                        <span className="text-green-700 text-xs font-medium">PAID</span>
                      ) : (
                        <span className="text-red-700 text-xs font-medium">DUE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalRows > 12 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs px-3 py-1 rounded border bg-white hover:bg-gray-50"
            >
              {showAll ? "Show less" : `Show all ${totalRows} rows`}
            </button>
          )}
        </div>
      )}

      {totalRows === 0 && (
        <div className="text-sm text-gray-400">No fee records in this range.</div>
      )}
    </Wrapper>
  );
}

function CustomFeesList({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left px-3 py-1.5">Title</th>
            <th className="text-right px-3 py-1.5">Amount</th>
            <th className="text-center px-3 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-1.5">{r.title}</td>
              <td className="px-3 py-1.5 text-right">{formatPKR(r.amount)}</td>
              <td className="px-3 py-1.5 text-center">
                {r.is_paid ? <span className="text-green-700 text-xs font-medium">PAID</span> : <span className="text-red-700 text-xs font-medium">DUE</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Wrapper({ title, children }) {
  return (
    <div className="bg-white border rounded mb-4">
      <div className="px-4 py-2 border-b">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = {
    red:   "text-red-700",
    green: "text-green-700",
    amber: "text-amber-700",
  };
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${tones[tone] || "text-gray-800"}`}>
        {value}
      </div>
    </div>
  );
}
