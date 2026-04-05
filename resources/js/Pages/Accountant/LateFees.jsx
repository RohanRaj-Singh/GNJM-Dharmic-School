import SimpleLayout from "@/Layouts/SimpleLayout";
import { useMemo, useState } from "react";

import LateFeesFiltersPanel from "./LateFees/LateFeesFiltersPanel";
import LateFeesSectionCard from "./LateFees/LateFeesSectionCard";
import {
  applyFilters,
  buildClassOptions,
  buildSectionOptions,
  getFilteredTotal,
  hasActiveFilters,
} from "./LateFees/utils";

export default function LateFees({
  dueThisMonth = [],
  dueOlder = [],
  totalPending = 0,
}) {
  const [classFilter, setClassFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allItems = useMemo(
    () => [...(dueThisMonth ?? []), ...(dueOlder ?? [])],
    [dueThisMonth, dueOlder]
  );

  const classOptions = useMemo(() => buildClassOptions(allItems), [allItems]);

  const sectionOptions = useMemo(
    () => buildSectionOptions(allItems, classFilter),
    [allItems, classFilter]
  );

  const filters = useMemo(
    () => ({
      classFilter,
      sectionFilter,
      search,
    }),
    [classFilter, sectionFilter, search]
  );

  const filteredDueThisMonth = useMemo(
    () => applyFilters(dueThisMonth, filters),
    [dueThisMonth, filters]
  );

  const filteredDueOlder = useMemo(
    () => applyFilters(dueOlder, filters),
    [dueOlder, filters]
  );

  const filteredTotalPending = useMemo(
    () => getFilteredTotal([...filteredDueThisMonth, ...filteredDueOlder]),
    [filteredDueThisMonth, filteredDueOlder]
  );

  const filtersAreActive = hasActiveFilters(filters);

  return (
    <SimpleLayout title="Late Fees">
      <div className="space-y-4">
        <LateFeesFiltersPanel
          classFilter={classFilter}
          sectionFilter={sectionFilter}
          search={search}
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          onClassFilterChange={(value) => {
            setClassFilter(value);
            setSectionFilter("all");
          }}
          onSectionFilterChange={setSectionFilter}
          onSearchChange={setSearch}
        />

        <LateFeesSectionCard
          emoji="[This Month]"
          title="Due This Month"
          description="Students whose monthly fee is pending for the current month"
          items={filteredDueThisMonth}
        />

        <LateFeesSectionCard
          emoji="[Older]"
          title="Pending From Previous Months"
          description="Fees pending from earlier months"
          items={filteredDueOlder}
        />

        <div className="bg-gray-50 border rounded-xl p-6 text-center">
          <h3 className="text-base font-medium text-gray-700">Total Pending Amount</h3>

          <p className="text-3xl font-semibold text-gray-800 mt-2">
            Rs. {filteredTotalPending}
          </p>

          <p className="text-sm text-gray-500 mt-1">
            {filtersAreActive
              ? "Combined unpaid monthly fees (filtered)"
              : "Combined unpaid monthly fees"}
          </p>

          {!filtersAreActive && Number(totalPending) !== filteredTotalPending ? (
            <p className="text-xs text-gray-400 mt-1">Overall total: Rs. {totalPending}</p>
          ) : null}
        </div>
      </div>
    </SimpleLayout>
  );
}
