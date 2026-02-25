# AWS Cost Management & Optimization Platform

A high-performance, production-grade AWS Cost Management Platform with 8 dashboards, admin panel, multi-account support, and AI-powered recommendations.

## Architecture

- **Backend**: Python FastAPI with SQLAlchemy (SQLite), boto3 for AWS APIs, JWT authentication
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Recharts

## Prerequisites

- Python 3.10+
- Node.js 18+
- AWS credentials configured (Organization management account recommended)
- AWS Cost Explorer API enabled

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- API Docs: http://localhost:8000/docs

### Default Admin Credentials

- **Username**: `kpiadmin`
- **Password**: `0LT6pcs-65xGV5P_DgUMUU`

## Features

### Dashboards
1. **Cost Dashboard** — Cost overview, trends, breakdowns by service/region/account/usage type, top resources, CSV/Excel export
2. **Forecast** — Cost forecasting with configurable horizons and confidence intervals
3. **Compute Optimizer** — EC2, EBS, Lambda, ASG, and ECS optimization recommendations
4. **Anomaly Detection** — Cost anomaly monitoring with root cause analysis
5. **Cost Optimization Hub** — Centralized recommendations, savings plans, and reservations
6. **AWS News** — Real-time AWS blog and news feed with search and categories
7. **AI Recommendations** — AI-powered downscale/upscale recommendations with confidence levels

### Admin Panel
- **AWS Accounts** — Add/remove/toggle member accounts with encrypted credential storage
- **Users** — Create, disable, delete users; reset passwords; show encrypted passwords
- **User Activity** — Monitor sessions, login history, IP addresses, revoke sessions

### Security
- JWT authentication with session tracking
- Encrypted AWS credential storage (Fernet)
- Session timeout (10 min inactivity)
- Max 2 concurrent sessions per user
- 5 login attempt limit (auto-disable)
- Rate limiting on API endpoints

### Performance
- TTL caching on all AWS API calls (5–10 min)
- Optimistic UI updates
- Lazy data fetching
- Responsive design with dark/light mode

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | (auto-generated) | JWT signing key |
| `DATABASE_URL` | `sqlite:///./cost_platform.db` | Database connection |
| `SESSION_TIMEOUT_MINUTES` | `10` | Session inactivity timeout |
| `MAX_SESSIONS_PER_USER` | `2` | Max concurrent sessions |
| `CACHE_TTL_SECONDS` | `300` | AWS API cache TTL |

## Docker

```bash
docker-compose up --build
```

The application will be available at http://localhost:3000.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── config.py          # Configuration
│   │   ├── database.py        # Database setup
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic schemas
│   │   ├── encryption.py      # Fernet encryption
│   │   ├── auth.py            # Authentication helpers
│   │   ├── main.py            # FastAPI app
│   │   ├── services/          # AWS service integrations
│   │   │   ├── aws_client.py
│   │   │   ├── cost_explorer.py
│   │   │   ├── forecast.py
│   │   │   ├── compute_optimizer.py
│   │   │   ├── anomaly_detection.py
│   │   │   ├── optimization_hub.py
│   │   │   ├── aws_news.py
│   │   │   └── ai_recommendations.py
│   │   └── routes/            # API route handlers
│   │       ├── auth.py
│   │       ├── costs.py
│   │       ├── forecast.py
│   │       ├── optimizer.py
│   │       ├── anomalies.py
│   │       ├── optimization_hub.py
│   │       ├── news.py
│   │       ├── ai.py
│   │       └── admin.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Router
│   │   ├── main.tsx           # Entry point
│   │   ├── api.ts             # Axios client
│   │   ├── context/           # React contexts
│   │   ├── components/        # Shared components
│   │   ├── hooks/             # Custom hooks
│   │   └── pages/             # Page components
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```
