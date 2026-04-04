# Technical Learning Roadmap: PharmaGest

This document provides a structured learning path for understanding the technologies and patterns used in the PharmaGest project. The roadmap follows a "prerequisites-first" approach, building from foundational concepts to advanced implementation details.

## Learning Path Overview

```
1. Data Modeling (Foundation)
   ↓
2. Python Type System & Validation
   ↓
3. FastAPI Fundamentals
   ↓
4. Database Integration (SQLAlchemy)
   ↓
5. Authentication & Security
   ↓
6. Dependency Injection
   ↓
7. Frontend Architecture (React Router + TanStack Query + Hooks)
   ↓
8. Chrome Extension Architecture
   ↓
9. Deployment & Environment
   ↓
10. Math Formulas & Business Logic
   ↓
11. Testing
```

---

## 1. Data Modeling (The Foundation)

### Why This Matters
Before writing any code, you must understand the domain model. PharmaGest models a pharmacy's business operations: products, purchases, sales, and users. The database schema is the single source of truth.

### Core Concepts

**Entities and Relationships:**
- **User** → belongs to → **Pharmacy** (Many-to-One)
- **Medicament** (Product Catalog) → has many → **Achat** (Purchases)
- **Medicament** → has many → **Vente** (Sales)

**Key Design Decisions:**
1. **PID as Universal Identifier**: Products are identified by Sobrus PID or barcode. This enables deduplication across imports.
2. **Denormalized Transaction Data**: Achats and Ventes store snapshot data (price, quantity) rather than computed values. This preserves historical accuracy even if catalog changes.
3. **Soft Relationships**: `medicament_id` can be NULL to handle orphaned transactions from incomplete imports.

### Learning Resources
- Database normalization (1NF, 2NF, 3NF)
- Entity-Relationship Diagrams (ERD)
- Foreign key constraints and cascading deletes
- Indexing strategies for query performance

### In This Project
Study `backend/models.py`:
- How `relationship()` defines bidirectional associations
- Why `back_populates` is used instead of `backref`
- The purpose of `index=True` on frequently queried columns
- How `server_default=func.now()` handles timestamps

---

## 2. Python Type System & Validation (Pydantic)

### Why This Matters
FastAPI relies heavily on Python type hints and Pydantic for automatic request validation, serialization, and API documentation generation. Understanding Pydantic is essential before learning FastAPI.

### Core Concepts

**Type Hints:**
```python
def process_user(name: str, age: int) -> dict:
    return {"name": name, "age": age}
```

**Pydantic Models:**
```python
from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    email: EmailStr  # Validates email format
    password: str
    name: str
```

**Why Pydantic Over Plain Dicts:**
1. **Automatic Validation**: Rejects invalid data before it reaches your business logic
2. **Type Safety**: Catches bugs at development time via type checkers (mypy, pyright)
3. **Self-Documenting**: Schema doubles as API documentation
4. **Serialization**: Converts between Python objects and JSON automatically

### Learning Resources
- Python type hints (PEP 484, 585, 604)
- Pydantic documentation: https://docs.pydantic.dev/
- `Optional[T]` vs `T | None` (modern union syntax)
- `model_config` for ORM integration

### In This Project
Study `backend/schemas.py`:
- How `EmailStr` validates email addresses
- Why `UserOut` has `model_config = {"from_attributes": True}`
- The difference between `UserRegister` (input) and `UserOut` (output)
- How `Optional[str] = None` makes fields optional

**Key Pattern:**
```python
class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    
    model_config = {"from_attributes": True}  # Enables ORM serialization
```

This allows FastAPI to convert SQLAlchemy `User` objects directly to JSON responses.

---

## 3. FastAPI Fundamentals

### Why This Matters
FastAPI is the web framework that handles HTTP requests, routing, and dependency injection. It's built on top of Starlette (ASGI framework) and Pydantic (validation).

### Core Concepts

**Path Operations (Routes):**
```python
@router.post("/auth/register", response_model=Token)
def register(body: UserRegister, db: Session = Depends(get_db)):
    # body is automatically validated against UserRegister schema
    # db is injected via dependency injection
    user = User(email=body.email, ...)
    db.add(user)
    db.commit()
    return {"access_token": "...", "user": user}
```

**Request Flow:**
1. Client sends POST request with JSON body
2. FastAPI validates JSON against `UserRegister` schema
3. If valid, calls `register()` with parsed `body` object
4. Function returns dict/object
5. FastAPI serializes response using `Token` schema
6. Client receives JSON response

**Automatic API Documentation:**
- FastAPI generates OpenAPI (Swagger) docs at `/docs`
- Pydantic schemas become request/response examples
- Type hints determine parameter types

### Learning Resources
- FastAPI tutorial: https://fastapi.tiangolo.com/tutorial/
- HTTP methods (GET, POST, PUT, DELETE)
- Status codes (200, 201, 400, 401, 404, 500)
- Query parameters vs path parameters vs request body

### In This Project
Study `backend/routers/auth.py`:
- How `@router.post()` decorator defines endpoints
- The role of `response_model=Token` in serialization
- How `HTTPException` returns error responses
- Why `Depends(get_db)` appears in function signatures

**Key Pattern:**
```python
@router.get("/achat", response_model=List[AchatOut])
def list_achats(
    page: int = Query(1, ge=1),  # Query parameter with validation
    db: Session = Depends(get_db),  # Dependency injection
    user: User = Depends(get_current_user),  # Authentication
):
    # Business logic here
    return results
```

---

## 4. Database Integration (SQLAlchemy ORM)

### Why This Matters
SQLAlchemy is the bridge between Python objects and SQL databases. It handles connection pooling, query building, and transaction management. Understanding the ORM prevents common pitfalls like N+1 queries and connection leaks.

### Core Concepts

**Declarative Models:**
```python
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    pharmacy = relationship("Pharmacy", back_populates="users")
```

**Session Management:**
```python
def get_db():
    db = SessionLocal()
    try:
        yield db  # Dependency injection provides this session
    finally:
        db.close()  # Always cleanup, even if exception occurs
```

**Query Building:**
```python
# Eager loading to prevent N+1 queries
query = (
    db.query(Achat)
    .options(joinedload(Achat.medicament))  # Load related medicament in same query
    .filter(Achat.delivery_date >= "2026-01-01")
    .order_by(Achat.id.desc())
    .limit(20)
)
```

### Learning Resources
- SQLAlchemy ORM tutorial: https://docs.sqlalchemy.org/en/20/tutorial/
- Relationship patterns (One-to-Many, Many-to-One, Many-to-Many)
- Lazy loading vs eager loading
- Transaction management and ACID properties

### In This Project
Study `backend/database.py` and `backend/models.py`:
- How `create_engine()` establishes database connection
- Why `sessionmaker(autocommit=False, autoflush=False)` is used
- The purpose of `relationship()` and `back_populates`
- How `Base.metadata.create_all()` creates tables

**Key Pattern (Upsert):**
```python
def _upsert_medicament(db: Session, pid: str, product: str, ...):
    med = db.query(Medicament).filter(Medicament.pid == pid).first()
    if not med:
        # Try name match as fallback
        med = db.query(Medicament).filter(Medicament.product.ilike(product)).first()
    if med:
        # Update existing
        med.pph = pph
        med.ppv = ppv
    else:
        # Insert new
        med = Medicament(pid=pid, product=product, ...)
        db.add(med)
    db.flush()  # Assign ID without committing transaction
    return med
```

This pattern prevents duplicate products while allowing catalog updates.

---

## 5. Authentication & Security

### Why This Matters
PharmaGest handles sensitive business data. Proper authentication prevents unauthorized access, and secure password storage protects user credentials even if the database is compromised.

### Core Concepts

**JWT (JSON Web Tokens):**
```python
payload = {"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}
token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

**Token Flow:**
1. User logs in with email/password
2. Backend validates credentials
3. Backend generates JWT containing user ID
4. Frontend stores token in sessionStorage
5. Frontend includes token in `Authorization: Bearer <token>` header
6. Backend validates token and extracts user ID

**Password Hashing (bcrypt):**
```python
# Registration
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

# Login
if bcrypt.checkpw(password.encode(), stored_hash):
    # Password correct
```

**Why bcrypt:**
- Slow by design (prevents brute-force attacks)
- Automatic salt generation (prevents rainbow table attacks)
- Adaptive cost factor (can increase difficulty over time)

### Learning Resources
- JWT specification: https://jwt.io/
- OAuth 2.0 and OpenID Connect (for future Google login)
- Password hashing best practices
- HTTPS and TLS (transport security)

**WhatsApp OTP Flow (Password Reset):**
In addition to email-based password reset, PharmaGest supports WhatsApp OTP via the Meta Cloud API:
1. User submits their phone number to `POST /auth/forgot-password-whatsapp`
2. Backend generates a 6-digit OTP, stores it with an expiry, and sends it via the WhatsApp Cloud API using the `password_reset_otp` authentication template
3. User receives the OTP on WhatsApp and submits it with their new password to `POST /auth/verify-otp`
4. Backend verifies the OTP, resets the password, and returns a JWT

### In This Project
Study `backend/utils/auth.py` and `backend/routers/auth.py`:
- How `create_access_token()` generates JWTs
- Why `SECRET_KEY` must be kept secret
- How `get_current_user()` validates tokens
- The role of `HTTPBearer` security scheme

**Key Pattern (Dependency Chain):**
```python
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401)
    return user

# Usage in routes
@router.get("/protected")
def protected_route(user: User = Depends(get_current_user)):
    # user is automatically injected and validated
    return {"message": f"Hello {user.name}"}
```

---

## 6. Dependency Injection

### Why This Matters
Dependency injection is FastAPI's mechanism for providing shared resources (database sessions, authenticated users) to route handlers. It enables clean separation of concerns and makes testing easier.

### Core Concepts

**What is Dependency Injection:**
Instead of creating resources inside functions:
```python
def my_route():
    db = SessionLocal()  # Bad: manual resource management
    try:
        # Use db
    finally:
        db.close()
```

Use FastAPI's `Depends()`:
```python
def my_route(db: Session = Depends(get_db)):
    # db is automatically provided and cleaned up
    # Use db
```

**Dependency Chains:**
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(db: Session = Depends(get_db)):
    # db is injected here
    return user

def protected_route(user: User = Depends(get_current_user)):
    # user is injected, which required db injection
    return {"user": user.name}
```

FastAPI resolves the chain: `get_db` → `get_current_user` → `protected_route`

### Learning Resources
- FastAPI dependencies: https://fastapi.tiangolo.com/tutorial/dependencies/
- Dependency injection pattern (general software design)
- Context managers and `yield` in Python

### In This Project
Study how dependencies are used throughout `backend/routers/`:
- `Depends(get_db)` provides database session
- `Depends(get_current_user)` provides authenticated user
- How `_: User = Depends(get_current_user)` enforces authentication without using the user object

**Key Pattern (Authentication Enforcement):**
```python
@router.post("/uploads/achat")
async def upload_achat(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),  # Enforces auth, discards user
):
    # If user is not authenticated, FastAPI returns 401 before this runs
    # We don't need the user object, just the authentication check
    return process_upload(file, db)
```

---

## 7. Frontend Architecture (React Router + TanStack Query + Hooks)

### Why This Matters
The frontend uses plain React Router for routing and TanStack Query for server state management. There is no framework abstraction layer (no Refine, no Next.js) -- just custom hooks and a typed API layer, giving full control and simpler debugging.

### Core Concepts

**Architecture:**
```
App.tsx (route guards: Protected, Guest, Pending, Role)
  └── routes.tsx (RouteConfig[] + ResourceConfig[] for sidebar)
        └── pages/ (thin UI, delegate to hooks)
              └── hooks/ (all TanStack Query/Mutation logic)
                    └── api/ (typed fetch wrappers, one file per domain)
```

**API Layer Pattern:**
```typescript
// api/client.ts — base request function
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${url}`, {
    headers: { Authorization: `Bearer ${getToken()}`, ...options?.headers },
    ...options,
  });
  if (res.status === 401) window.dispatchEvent(new Event("auth:unauthorized"));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// api/transactions.ts — domain-specific calls
export const getAchatList = (params: AchatParams) =>
  request<PaginatedResponse<Achat>>(`/achat?${toQuery(params)}`);
```

**Hook Pattern:**
```typescript
// hooks/useAchatList.ts
export function useAchatList(params: AchatParams) {
  return useQuery({
    queryKey: [QUERY_KEYS.ACHAT, params],
    queryFn: () => getAchatList(params),
  });
}
```

**Why This Architecture:**
1. **Simplicity**: No framework abstraction layer between you and the API
2. **Full control**: Custom hooks can handle any API shape or side effect
3. **Caching**: TanStack Query provides automatic caching and refetching
4. **Type Safety**: Full TypeScript from API call to component prop

**Key Hooks:**
- `useAnalysePage` -- drives the Rapports/analytics pages, handles filter state, KPI aggregation, and chart data
- `useAccounting` -- financial calculations (marge, TVA, totals) used across achat/vente views
- Enums `eCategoryType`, `eRequestStatus`, `eRequestType` from `types/index.ts` are used in all hooks and components to avoid string literals

### Learning Resources
- React fundamentals: https://react.dev/learn
- TanStack Query: https://tanstack.com/query/latest
- React Router v7: https://reactrouter.com/
- Zod: https://zod.dev/

### In This Project
Study `frontend/src/`:
- `api/client.ts`: Base request function with auth and error handling
- `api/auth.ts`: Auth API calls (login, signup, me, password reset)
- `hooks/useAuthenticate.ts`: Auth mutations (login, register, logout)
- `hooks/useAchatList.ts`: Paginated data query with filters
- `routes.tsx`: How routes are configured with role guards
- `pages/achat/index.tsx`: How hooks provide data to the table UI

**Key Pattern (Data Fetching):**
```typescript
// In the page component — thin UI, no direct TanStack usage
function AchatPage() {
  const [params, setParams] = useState<AchatParams>({ page: 1, limit: 20 });
  const { data, isLoading } = useAchatList(params);

  return (
    <DataTable
      data={data?.items ?? []}
      total={data?.total ?? 0}
      loading={isLoading}
      onParamsChange={setParams}
    />
  );
}
```

---

## 8. Chrome Extension Architecture

### Why This Matters
The Chrome extension is the primary data input method for PharmaGest. It bridges the gap between the Sobrus web interface and the PharmaGest backend by capturing data directly from the browser. Understanding Chrome Extension architecture is essential for maintaining and extending the data capture functionality.

### Core Concepts

**Chrome Extension Components:**
```
┌─────────────────────────────────────────────────────┐
│  Popup UI (React)                                   │
│  - User interface for manual capture                │
│  - Login status and data type selection             │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Background Service Worker                          │
│  - Token storage (Chrome Storage API)               │
│  - CSV upload orchestration                         │
│  - Tab management                                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Content Scripts (Isolated World)                   │
│  - DOM table extraction                             │
│  - Sobrus CSV intercept                             │
│  - Real-time progress banners                       │
└─────────────────────────────────────────────────────┘
```

**Manifest V3 Structure:**
```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "storage", "tabs", "scripting"],
  "background": {
    "service_worker": "src/background/index.ts"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"]
    }
  ]
}
```

**Why This Architecture:**
1. **Content Scripts**: Run in isolated world, can access DOM but not localhost
2. **Background Service Worker**: Can make requests to localhost, handles uploads
3. **Message Passing**: Content scripts send data to background via `chrome.runtime.sendMessage()`
4. **Chrome Storage API**: Persists tokens and notifications across browser sessions

### Key Patterns

**Pattern 1: Token Relay (Content Script → Background)**
```typescript
// Content script (runs on dashboard)
const token = localStorage.getItem("apcm_token");
chrome.runtime.sendMessage({ action: "STORE_TOKEN", token });

// Background service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "STORE_TOKEN") {
    chrome.storage.local.set({ apcm_token: request.token });
  }
});
```

**Pattern 2: CSV Intercept (Sobrus Pages)**
```typescript
// Content script on Sobrus export pages
document.addEventListener("click", async (e) => {
  const anchor = e.target.closest('a[download][href*="sobrus.com"]');
  if (!anchor) return;
  
  // Fetch CSV directly (session cookies included)
  const csvText = await fetch(anchor.href, { credentials: "include" }).then(r => r.text());
  
  // Split into chunks (500 rows each)
  const chunks = splitIntoChunks(csvText, 500);
  
  // Send each chunk to background for upload
  for (const chunk of chunks) {
    await chrome.runtime.sendMessage({
      action: "UPLOAD_CHUNK",
      csvChunk: chunk,
      fileType: "achat"
    });
  }
});
```

**Pattern 3: Real-time Progress (Chrome Storage Sync)**
```typescript
// Background: Update upload status
chrome.storage.local.set({
  upload_status: {
    state: "uploading",
    current: 2,
    total: 10,
    fileType: "achat"
  }
});

// Content script: Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.upload_status) {
    const status = changes.upload_status.newValue;
    updateProgressBanner(status); // Update UI in real-time
  }
});
```

**Pattern 4: DOM Table Extraction**
```typescript
function extractTableInRect(rect: { left, top, width, height }) {
  // Find table with most overlap with selection rectangle
  const tables = document.querySelectorAll("table");
  let bestTable = null;
  let bestOverlap = 0;
  
  for (const table of tables) {
    const bounds = table.getBoundingClientRect();
    const overlap = calculateOverlap(bounds, rect);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestTable = table;
    }
  }
  
  // Extract headers and rows
  const headers = Array.from(bestTable.querySelectorAll("thead th"))
    .map(th => th.textContent.trim());
  
  const rows = Array.from(bestTable.querySelectorAll("tbody tr"))
    .map(tr => {
      const cells = Array.from(tr.querySelectorAll("td"));
      return Object.fromEntries(
        headers.map((h, i) => [h, cells[i]?.textContent.trim()])
      );
    });
  
  return { headers, rows };
}
```

### Learning Resources
- Chrome Extension documentation: https://developer.chrome.com/docs/extensions/
- Manifest V3 migration guide: https://developer.chrome.com/docs/extensions/migrating/
- Chrome Storage API: https://developer.chrome.com/docs/extensions/reference/storage/
- Content Scripts vs Background Scripts: https://developer.chrome.com/docs/extensions/mv3/architecture-overview/
- Message passing: https://developer.chrome.com/docs/extensions/mv3/messaging/

### In This Project
Study `extension/src/`:
- `background/index.ts`: Token storage, upload orchestration, tab management
- `content/index.ts`: Token relay, notifications, area selection tool
- `content/sobrus-export.ts`: CSV intercept, chunked upload logic
- `content/sobrus-ui.ts`: Progress banner UI on Sobrus pages
- `popup/app.tsx`: Extension popup with capture controls
- `lib/api.ts`: Backend API client (uses fetch with JWT)
- `lib/storage.ts`: Chrome Storage API wrapper
- `hooks/use-capture.ts`: Area selection state management

**Key Design Decisions:**
1. **Chunked Upload (500 rows)**: Prevents timeout and memory issues with large CSV files
2. **Background Upload**: Content scripts cannot reach localhost due to CORS, so background handles uploads
3. **Chrome Storage Sync**: Enables real-time UI updates across tabs (Sobrus page + dashboard)
4. **Token Relay**: Dashboard stores token in localStorage, content script syncs to Chrome Storage for extension access
5. **Bounding Box Overlap**: Area selection uses geometric overlap detection to find tables within selected region
6. **Upload Queue System**: Uploads are managed via an in-memory jobs array in the background service worker. Each job tracks file type, chunk progress, and status (pending/uploading/done/error). This enables batch tracking -- multiple CSV files can be queued and processed sequentially without losing state

---

## 9. Deployment & Environment

### Why This Matters
Environment variables separate configuration from code, enabling the same codebase to run in development, staging, and production with different settings.

### Core Concepts

**Environment Variables:**

PharmaGest uses an `env/` folder structure with `APP_ENV` to select the active environment:

```
env/
├── dev/       # local development
├── demo/      # Docker demo build
├── prod/      # production
└── test/      # test suite
```

```python
# backend/database.py
import os
from dotenv import load_dotenv

app_env = os.getenv("APP_ENV", "dev")
load_dotenv(f"env/{app_env}/.env.backend")
DATABASE_URL = os.getenv("DATABASE_URL")
```

**Why This Pattern:**
1. **Security**: Secrets never committed to version control
2. **Flexibility**: Same code runs in multiple environments via `APP_ENV`
3. **12-Factor App**: Industry standard for cloud-native apps

**Docker Compose:**
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
```

### Learning Resources
- The Twelve-Factor App: https://12factor.net/
- Docker documentation: https://docs.docker.com/
- Environment variable best practices
- Database connection pooling

### In This Project
Study:
- `.env.example` files (templates for environment variables)
- `docker-compose.yml` (PostgreSQL containerization)
- `Makefile` (development workflow automation)
- How `load_dotenv()` loads variables in `backend/database.py`

**Key Pattern (Environment-Specific Config):**
```python
# Development
DATABASE_URL = "postgresql://localhost:5432/apcm_dev"

# Production
DATABASE_URL = "postgresql://prod-server:5432/apcm_prod"

# Same code, different behavior based on environment
```

---

## 10. Math Formulas & Business Logic

### Why This Matters
PharmaGest computes financial KPIs for pharmacy owners. Understanding the formulas ensures the analytics engine produces correct results and that edge cases (zero denominators, missing prices) are handled gracefully.

### Margin Formulas

**Marge brute (Gross Margin):**
```
Marge brute = PPV - PPH
```
Where PPV = Prix Public de Vente, PPH = Prix Hors Taxe (purchase price).

**Marge % (Margin Percentage):**
```
Marge % = ((PPV - PPH) / PPH) * 100
```

Example: PPH = 80 MAD, PPV = 120 MAD
```
Marge brute = 120 - 80 = 40 MAD
Marge %     = (40 / 80) * 100 = 50%
```

**Marge nette (Net Margin):**
```
Marge nette = Marge brute - (TVA amount)
            = (PPV - PPH) - (PPV * TVA_rate / (100 + TVA_rate))
```

### PU Weighted Average (Prix Unitaire Moyen Pondere)

When a product is purchased at different prices across multiple imports:
```
PU moyen = SUM(quantity_i * unit_price_i) / SUM(quantity_i)
```

Example: 50 units at 10 MAD + 30 units at 12 MAD
```
PU moyen = (50*10 + 30*12) / (50+30) = 860/80 = 10.75 MAD
```

### TVA Calculations

Morocco uses multiple TVA rates (0%, 7%, 10%, 14%, 20%). The system groups transactions by TVA rate and computes:

```
TVA amount       = PPV * TVA_rate / (100 + TVA_rate)
Montant HT       = PPV - TVA amount
Total TVA (group)= SUM(TVA amount for all items in group)
```

### Stock ABCD Classification

Products are classified into 4 categories based on their contribution to total revenue:

```
Ratio = (product_revenue / total_revenue) * 100
```

| Class | Cumulative ratio range |
|-------|----------------------|
| A     | 0% -- 80%            |
| B     | 80% -- 95%           |
| C     | 95% -- 99%           |
| D     | 99% -- 100%          |

Products are sorted by revenue descending, then assigned a class based on where their cumulative ratio falls.

### Stock MIN / MAX Formulas

```
Stock MIN = average_daily_sales * lead_time_days * safety_factor
Stock MAX = Stock MIN + (average_daily_sales * reorder_period_days)
```

Where:
- `average_daily_sales` = total quantity sold / number of days in period
- `lead_time_days` = supplier delivery delay
- `safety_factor` = buffer multiplier (typically 1.5)
- `reorder_period_days` = time between orders

### Sante Financiere (Financial Health Grading)

The system assigns a grade based on combined KPI scores:

| Grade | Criteria                                         |
|-------|--------------------------------------------------|
| A     | Marge % >= 30%, stock rotation healthy, no debt  |
| B     | Marge % >= 20%, minor stock issues               |
| C     | Marge % >= 10%, stock or debt concerns            |
| D     | Marge % < 10% or critical financial indicators    |

---

## 11. Testing

### Why This Matters
PharmaGest has 298 tests across backend, frontend, and extension. Understanding the test setup ensures you can write reliable tests and debug failures quickly.

### Backend Tests (pytest)

**Setup:**
- Tests use `APP_ENV=test` which loads `env/test/.env.backend` with a dedicated test database
- `conftest.py` provides shared fixtures: `db_session`, `client`, `admin_user`, `owner_user`
- Each test runs inside a **transaction that is rolled back** after completion, ensuring test isolation without needing to recreate the database

**Key patterns:**
```python
# conftest.py
@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()  # All changes reverted
    connection.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

**Running:**
```bash
make test-back   # runs pytest with APP_ENV=test
```

### Frontend Tests (vitest + MSW)

**Setup:**
- Uses vitest as the test runner (compatible with Vite config)
- MSW (Mock Service Worker) intercepts API calls at the network level
- No real backend needed -- all API responses are mocked

**Key patterns:**
```typescript
// Mock API handler
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/achat", () => {
    return HttpResponse.json({ items: [...], total: 10 });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Running:**
```bash
make test-front   # runs vitest
```

### Extension Tests (vitest + Chrome API Mocks)

**Setup:**
- Uses vitest with Chrome API mocking (chrome.storage, chrome.runtime, chrome.tabs)
- Global mocks defined in test setup file replace `chrome.*` APIs with vi.fn() stubs

**Key patterns:**
```typescript
// Chrome API mock setup
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: { addListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
  },
} as any;
```

**Running:**
```bash
make test-ext   # runs vitest for extension
```

---

## Advanced Topics (Future Learning)

Once you've mastered the core concepts, explore these advanced topics:

### Asynchronous Programming
- `async`/`await` in Python
- FastAPI's async route handlers
- Database connection pooling with asyncpg

### Testing
- pytest for backend testing
- Vitest + React Testing Library for frontend
- Test fixtures and mocking
- Integration tests vs unit tests

### Database Migrations
- Alembic for schema versioning
- Migration strategies (additive vs destructive)
- Zero-downtime deployments

### Performance Optimization
- Database query optimization (EXPLAIN ANALYZE)
- Caching strategies (Redis)
- CDN for static assets
- Lazy loading and code splitting

### Monitoring & Observability
- Logging best practices
- Error tracking (Sentry)
- Application performance monitoring (APM)
- Database query monitoring

---

## Recommended Learning Order

1. **Week 1-2**: Data Modeling + Python Type Hints + Pydantic
   - Read `backend/models.py` and `backend/schemas.py`
   - Draw ERD diagram of database schema
   - Practice writing Pydantic models

2. **Week 3-4**: FastAPI Fundamentals + SQLAlchemy
   - Build a simple CRUD API
   - Study `backend/routers/auth.py`
   - Practice writing queries in `backend/routers/achat.py`

3. **Week 5-6**: Authentication + Dependency Injection
   - Implement JWT authentication from scratch
   - Study `backend/utils/auth.py`
   - Understand dependency chains in route handlers

4. **Week 7-8**: React + TanStack Query
   - Build a simple admin dashboard
   - Study `frontend/src/pages/achat/index.tsx`
   - Practice writing custom hooks with `useQuery` and `useMutation`

5. **Week 9-10**: Chrome Extension
   - Build a simple content script that extracts table data
   - Study `extension/src/content/sobrus-export.ts`
   - Understand message passing between content script and background
   - Learn Chrome Storage API for token persistence

6. **Week 11-12**: Integration + Deployment
   - Connect all components together (extension → backend → dashboard)
   - Set up Docker Compose for PostgreSQL
   - Deploy to a cloud provider (Render, Railway, Fly.io)

---

## Conclusion

This learning path is designed to build your understanding incrementally. Each layer depends on the previous one:

- **Data Modeling** defines what you're building
- **Pydantic** validates your data
- **FastAPI** exposes your data via HTTP
- **SQLAlchemy** persists your data
- **Authentication** secures your data
- **Dependency Injection** organizes your code
- **React + TanStack Query** presents your data
- **Chrome Extension** captures your data
- **Deployment** delivers your application

Focus on understanding the "why" behind each technology choice. The PharmaGest codebase demonstrates production-ready patterns that you can apply to any full-stack application.
