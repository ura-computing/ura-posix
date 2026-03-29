VALID_ROLES = {"admin", "owner", "employee"}

FEATURE_FLAGS = ["rapports", "import", "achat", "ventes", "stock"]

REQUEST_TYPES = {"new_product", "non_declare"}


class Role:
    ADMIN = "admin"
    OWNER = "owner"
    EMPLOYEE = "employee"


class Status:
    PENDING = "pending"
    ACTIVE = "active"
    REJECTED = "rejected"


class RequestStatus:
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RequestType:
    NEW_PRODUCT = "new_product"
    NON_DECLARE = "non_declare"
    ANNULATION = "annulation"
