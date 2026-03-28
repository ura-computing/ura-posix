import { API_URL } from "@/constants";

export type PharmacyPublic = { id: number; name: string };

export const listPharmacies = (): Promise<PharmacyPublic[]> =>
  fetch(`${API_URL}/public/pharmacies`).then((r) => r.json()) as Promise<PharmacyPublic[]>;
