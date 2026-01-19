import SimpleLayout from "@/Layouts/SimpleLayout";
import { Link } from "@inertiajs/react";

export default function Sections({ sections }) {
  return (
    <SimpleLayout title="Select Section">
      <div className="space-y-3">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/accountant/mark-attendance/${section.id}`}
            className="block bg-white border rounded-xl p-4 hover:bg-gray-50"
          >
            <p className="font-semibold text-gray-800">
              {section.school_class.name}
            </p>
            <p className="text-sm text-gray-500">
              {section.name}
            </p>
          </Link>
        ))}
      </div>
    </SimpleLayout>
  );
}
