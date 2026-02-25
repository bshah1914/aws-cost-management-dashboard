from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.models import User
from app.auth import hash_password
from app.encryption import encrypt_value
from app.routes import auth, costs, forecast, optimizer, anomalies, optimization_hub, news, ai, admin

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AWS Cost Management Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router)
app.include_router(costs.router)
app.include_router(forecast.router)
app.include_router(optimizer.router)
app.include_router(anomalies.router)
app.include_router(optimization_hub.router)
app.include_router(news.router)
app.include_router(ai.router)
app.include_router(admin.router)


@app.on_event("startup")
def seed_admin():
    """Create default admin user if not exists."""
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "kpiadmin").first()
        if not admin:
            admin_password = "0LT6pcs-65xGV5P_DgUMUU"
            admin = User(
                username="kpiadmin",
                hashed_password=hash_password(admin_password),
                plain_password_encrypted=encrypt_value(admin_password),
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            print("Admin user 'kpiadmin' created.")
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
