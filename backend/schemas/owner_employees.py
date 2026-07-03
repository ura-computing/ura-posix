"""Shapes for the owner's /owner/employees (Gérer mon équipe) page.

Reuses the member / permission schemas from admin_pharmacies — the shape of
a user is the same whether admin or owner looks at it. The owner endpoints
add ONE extra response shape: the page's initial GET returns the employees
list PLUS the contextual ceiling info (pharmacy features + owner's own
permissions) in one round-trip, so the EmployeePermissionsDialog can render
its 2-layer ceiling without a second fetch."""
from __future__ import annotations

from pydantic import BaseModel

from schemas.admin_pharmacies import MemberOut


class OwnerEmployeesResponse(BaseModel):
    """One-shot payload for /owner/employees:
      - employees: members of the caller's pharmacy with role="employee"
      - pharmacy_features: the pharmacy's enabled features (ceiling layer 1)
      - my_permissions: the calling owner's own granted permissions (ceiling layer 2)
    Together the two ceiling lists let the frontend disable any employee
    permission toggle that EITHER layer doesn't allow."""
    employees:         list[MemberOut]
    pharmacy_features: list[str]
    my_permissions:    list[str]
