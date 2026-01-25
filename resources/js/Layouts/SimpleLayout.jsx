import { Head } from "@inertiajs/react";
import {usePage} from "@inertiajs/react";
import {router} from "@inertiajs/react";

export default function SimpleLayout({title, children})
{
  const {flash} = usePage().props;
    return (
        <div className="min-h-screen bg-gray-100">
            <Head title={title}></Head>
            {/*Top Bar*/}
            <header className="bg-white shadow-sm sticky top-0 z-10">
  <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">

    {/* logout Button */}
    <button
      onClick={() => router.post('/logout')}
      className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-sm"
      aria-label="Go back"
    >
      Logout
    </button>

    {/* Title */}
    <div className="flex-1 text-center">
      <h1 className="text-sm font-semibold text-gray-800">
        {title ?? "GNJM"}
      </h1>
    </div>

  </div>
</header>


            {/*Main Content*/}
            <main className="max-w-md mx-auto px-4 py-4 pb-24">
              {flash?.success && (
  <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
    {flash.success}
  </div>
)}
  {children}
</main>
{/* Bottom Navigation */}
<div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
  <div className="max-w-md mx-auto flex justify-around py-3">

    {/* Back */}
    <button
      onClick={() =>
        window.history.length > 1
          ? window.history.back()
          : router.visit('/accountant')
      }
      className="flex flex-col items-center text-gray-700"
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 border text-xl">
        ←
      </div>
      <span className="text-xs mt-1">Back</span>
    </button>

    {/* Home */}
    <button
onClick={() => window.location.href = '/accountant'}
      className="flex flex-col items-center text-gray-700"
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 border text-xl">
        🏠
      </div>
      <span className="text-xs mt-1">Home</span>
    </button>

  </div>
</div>


        </div>
    );
}
