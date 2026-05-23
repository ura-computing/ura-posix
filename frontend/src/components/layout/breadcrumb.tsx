"use client";

import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem as ShadcnBreadcrumbItem,
  BreadcrumbList as ShadcnBreadcrumbList,
  BreadcrumbPage as ShadcnBreadcrumbPage,
  BreadcrumbSeparator as ShadcnBreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";
import { Fragment } from "react";
import { Link, useLocation } from "react-router";

const PATH_LABELS: Record<string, string> = {
  achat: "Achats",
  ventes: "Ventes",
  stock: "Stock",
  rapports: "Tableau de Bord",
  parametres: "Paramètres",
  profile: "Mon profil",
  "dashboard": "Tableau de Bord",
  "dashboard/upload-file": "Importer",
  "admin/pharmacies": "Pharmacies",
  "admin/catalog-requests": "Produits spéciaux",
  "admin/catalog": "Catalogue",
  "owner/employees": "Mes employés",
  "catalog-requests": "Produits spéciaux",
  analyse: "Analyse",
  comptabilite: "Comptabilité",
};

export function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
  const label = PATH_LABELS[segments.join("/")] ?? PATH_LABELS[segments[0]] ?? segments[0];

  if (!label) {
    return (
      <ShadcnBreadcrumb>
        <ShadcnBreadcrumbList>
          <ShadcnBreadcrumbPage>
            <Link to="/"><Home className="h-4 w-4" /></Link>
          </ShadcnBreadcrumbPage>
        </ShadcnBreadcrumbList>
      </ShadcnBreadcrumb>
    );
  }

  return (
    <ShadcnBreadcrumb>
      <ShadcnBreadcrumbList>
        <Fragment>
          <ShadcnBreadcrumbItem>
            <Link to="/"><Home className="h-4 w-4" /></Link>
          </ShadcnBreadcrumbItem>
          <ShadcnBreadcrumbSeparator />
        </Fragment>
        <ShadcnBreadcrumbPage>{label}</ShadcnBreadcrumbPage>
      </ShadcnBreadcrumbList>
    </ShadcnBreadcrumb>
  );
}

Breadcrumb.displayName = "Breadcrumb";
