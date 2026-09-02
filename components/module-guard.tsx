import { ModuleId, MODULES } from "@/config/modules";
import Link from "next/link";

type Props = {
  moduleId: ModuleId;
  enabledModules: ModuleId[];
  children: React.ReactNode;
};

export default function ModuleGuard({ moduleId, enabledModules, children }: Props) {
  if (enabledModules.includes(moduleId)) {
    return <>{children}</>;
  }

  const mod = MODULES[moduleId];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-3xl text-gray-400">{mod.icon}</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{mod.name}</h2>
      <p className="text-gray-500 mb-6 max-w-md">{mod.description}</p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 mb-6">
        <p className="text-amber-800 text-sm font-medium">
          This module is not part of your current plan.
        </p>
      </div>
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
      >
        <span className="material-symbols-outlined text-lg">upgrade</span>
        Upgrade Plan
      </Link>
    </div>
  );
}
