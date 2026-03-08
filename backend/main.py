from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import achat, admin, auth, catalog_requests, data, owner, public, uploads, vente

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PharmaGest API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(uploads.router)
app.include_router(achat.router)
app.include_router(vente.router)
app.include_router(data.router)
app.include_router(admin.router)
app.include_router(owner.router)
app.include_router(catalog_requests.router)


@app.get("/health")
def health():
    return {"status": "ok"}
