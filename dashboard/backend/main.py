from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import achat, auth, uploads, vente

Base.metadata.create_all(bind=engine)

app = FastAPI(title="PharmaGest API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(achat.router)
app.include_router(vente.router)


@app.get("/health")
def health():
    return {"status": "ok"}
