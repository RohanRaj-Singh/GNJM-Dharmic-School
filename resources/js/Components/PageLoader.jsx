export default function PageLoader({ text = "Loading..." }) {
    return (
        <div className="relative min-h-[300px] bg-white border rounded-lg">
            <div className="absolute inset-0 z-30 bg-white/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
                    <p className="text-sm text-gray-600">{text}</p>
                </div>
            </div>
        </div>
    );
}
