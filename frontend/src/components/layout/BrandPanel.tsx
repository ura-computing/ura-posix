import { PharmagestIcon } from "@/components/shared/PharmagestIcon";

export function BrandPanel() {
  return (
    <aside className="brand-aurora hidden md:flex flex-col justify-between p-12 text-white">
      <div className="flex items-center gap-3">
        <PharmagestIcon size={42} className="text-white" />
        <span className="text-2xl font-semibold tracking-tight">PharmaGest</span>
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold leading-tight max-w-md">
          Gestion de pharmacie simplifiée
        </h2>
        <p className="text-base opacity-80 max-w-md">
          Une vue d'ensemble claire sur vos ventes, votre stock et vos marges.
        </p>
      </div>
      <p className="text-sm opacity-60">© 2026 PharmaGest</p>
    </aside>
  );
}