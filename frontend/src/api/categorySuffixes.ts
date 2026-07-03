import { api } from "@/api/client";
import type { CategorySuffixOut, CategorySuffixIn } from "@/types";


export function listCategorySuffixes(): Promise<CategorySuffixOut[]> {
  return api<CategorySuffixOut[]>("/category-suffixes");
}

export function createCategorySuffix(body: CategorySuffixIn): Promise<CategorySuffixOut> {
  return api<CategorySuffixOut>("/category-suffixes", { method: "POST", body });
}

export function updateCategorySuffix(id: number, body: CategorySuffixIn): Promise<CategorySuffixOut> {
  return api<CategorySuffixOut>(`/category-suffixes/${id}`, { method: "PUT", body });
}

export function deleteCategorySuffix(id: number): Promise<void> {
  return api<void>(`/category-suffixes/${id}`, { method: "DELETE" });
}
